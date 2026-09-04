import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WAJBTI_SYSTEM_PROMPT, ANALYZE_ENGLISH_INSTRUCTION } from "@/lib/systemPrompt";
import { findSimilarCorrections } from "@/lib/corrections";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Vercel's default serverless timeout (10s on Hobby) is too short for a
// vision + long-output Claude call - a detailed food photo can easily take
// 15-30s to analyze. Without this, the function gets killed mid-request and
// the client just sees a generic failure with no indication it was a timeout.
export const maxDuration = 60;

// POST body: { description?: string, imageBase64?: string, mediaType?: string, voiceNote?: string, diningMode?: boolean, clarificationHistory?: {question: string, answer: string}[], userId?: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { description, imageBase64, mediaType, voiceNote, diningMode, clarificationHistory, userId, lang } = body;

    if (!description && !imageBase64) {
      return NextResponse.json(
        { error: "لازم توفر وصف أو صورة للوجبة" },
        { status: 400 }
      );
    }

    // 1) خطوة الاسترجاع: نفحص إذا في تصحيحات سابقة شبيهة (RAG بسيط عبر بحث نصي)
    const retrievedCorrections = await findSimilarCorrections({
      description: description || "",
    });

    // 1b) لو المستخدم مسجل دخول، نجيب حالة حمل/رضاعة وأي تفضيلات/حساسيات
    // أكل سبق وذكرها بالشات عشان النصيحة والتحذيرات الغذائية تراعيها.
    let pregnancyStatus: string | null = null;
    let foodNotes: string[] = [];
    const session = await getServerSession(authOptions).catch(() => null);
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    if (sessionUserId) {
      const [profile, notes] = await Promise.all([
        prisma.profile.findUnique({ where: { userId: sessionUserId } }),
        prisma.foodNote.findMany({ where: { userId: sessionUserId }, select: { note: true } }),
      ]);
      if (profile?.pregnancyStatus && profile.pregnancyStatus !== "none") {
        pregnancyStatus = profile.pregnancyStatus;
      }
      foodNotes = notes.map((n) => n.note);
    }

    // 2) نبني محتوى الرسالة للـ API
    const contentBlocks: Anthropic.MessageParam["content"] = [];

    if (imageBase64) {
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType || "image/jpeg",
          data: imageBase64,
        },
      });
    }

    let textPrompt = description ? `وصف الوجبة: ${description}` : "حلل الوجبة من الصورة المرفقة.";
    if (voiceNote) {
      textPrompt += `\nملاحظة صوتية من المستخدم: ${voiceNote}`;
    }
    if (diningMode) {
      textPrompt +=
        "\n\nملاحظة سياق: هذه الوجبة من خارج المنزل (مطعم/بوفيه/دعوة) - لم يُعدّها المستخدم بنفسه ولا يعرف تفاصيل الوصفة بدقة. وسّع هامش تقديرك خصوصاً للزيت/السمن/الصلصات الخفية، واذكر بوضوح أن دقة التقدير أقل من الوجبة المنزلية.";
    }
    if (pregnancyStatus === "pregnant") {
      textPrompt +=
        "\n\nملاحظة سياق: المستخدمة حامل حالياً. لو في بالوجبة أي عنصر غير آمن بالحمل (بيض نيء/سائل، لحم أو سمك نيء أو غير مطبوخ جيداً، أجبان غير مبسترة، كمية كبيرة من الكافيين)، نبّهها بلطف ضمن ai_nutritionist_tip.";
    }
    if (pregnancyStatus === "breastfeeding") {
      textPrompt +=
        "\n\nملاحظة سياق: المستخدمة مرضعة حالياً. راعِ ذلك في نصيحتك (احتياج غذائي إضافي، سوائل).";
    }
    if (retrievedCorrections.length > 0) {
      textPrompt += `\n\nretrieved_corrections: ${JSON.stringify(retrievedCorrections)}`;
    }
    if (foodNotes.length > 0) {
      textPrompt += `\n\nknown_food_notes: ${JSON.stringify(foodNotes)}`;
    }
    if (Array.isArray(clarificationHistory) && clarificationHistory.length > 0) {
      textPrompt += "\n\nتوضيحات إضافية من المستخدم رداً على أسئلتك السابقة:";
      for (const item of clarificationHistory) {
        textPrompt += `\nسؤالك: ${item.question}\nجواب المستخدم: ${item.answer}`;
      }
      textPrompt +=
        "\n\nاستخدم هاي التوضيحات لتحسين تقديرك. لو صارت المعلومات كافية، أرجع تحليل كامل (مو سؤال توضيحي جديد) إلا إذا كانت ضرورية فعلاً معلومة تانية أساسية ناقصة.";
      if (clarificationHistory.length >= 3) {
        textPrompt +=
          "\n\nملاحظة مهمة: سألت المستخدم 3 أسئلة توضيحية أصلاً - لا تسأل سؤال رابع. أعطِ أفضل تقدير ممكن بناءً على كل المعلومات المتوفرة لحد الآن، حتى لو الثقة متوسطة، واذكر مستوى الثقة confidence_score بصدق.";
      }
    }

    contentBlocks.push({ type: "text", text: textPrompt });

    // 3) استدعاء Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      // Cached: identical for every analyze call across every user, so this
      // stops being billed at full price after the first request in the
      // cache window (huge win given this is the highest-volume route).
      system:
        lang === "en"
          ? [
              { type: "text", text: WAJBTI_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
              { type: "text", text: ANALYZE_ENGLISH_INSTRUCTION },
            ]
          : [{ type: "text", text: WAJBTI_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: contentBlocks }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "{}";

    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({ ...parsed, dining_mode: !!diningMode });
  } catch (err: any) {
    console.error("Wajbti analyze error:", err);
    return NextResponse.json(
      { error: "صار خطأ بالتحليل، جرب مرة تانية" },
      { status: 500 }
    );
  }
}
