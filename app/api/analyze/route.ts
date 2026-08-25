import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WAJBTI_SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { findSimilarCorrections } from "@/lib/corrections";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// POST body: { description?: string, imageBase64?: string, mediaType?: string, voiceNote?: string, diningMode?: boolean, clarificationHistory?: {question: string, answer: string}[], userId?: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { description, imageBase64, mediaType, voiceNote, diningMode, clarificationHistory, userId } = body;

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

    // 1b) لو المستخدم مسجل دخول وحدد حالة حمل/رضاعة بملفه، نمرر هاي المعلومة
    // عشان النصيحة والتحذيرات الغذائية تراعيها.
    let pregnancyStatus: string | null = null;
    const session = await getServerSession(authOptions).catch(() => null);
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    if (sessionUserId) {
      const profile = await prisma.profile.findUnique({ where: { userId: sessionUserId } });
      if (profile?.pregnancyStatus && profile.pregnancyStatus !== "none") {
        pregnancyStatus = profile.pregnancyStatus;
      }
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
        "\n\nملاحظة سياق: هاي الوجبة من برا البيت (مطعم/بوفيه/عزومة) - المستخدم ما طبخها بنفسه وما بيعرف تفاصيل الوصفة بدقة. وسّع هامش تقديرك خصوصاً للزيت/السمن/الصوصات المخفية، واذكر بوضوح إن دقة التقدير أقل من وجبة بيتية.";
    }
    if (pregnancyStatus === "pregnant") {
      textPrompt +=
        "\n\nملاحظة سياق: المستخدمة حامل حالياً. لو في بالوجبة أي عنصر غير آمن بالحمل (بيض نيء/سائل، لحم أو سمك نيء أو غير مطبوخ جيداً، أجبان غير مبسترة، كمية كبيرة من الكافيين)، نبّهها بلطف ضمن ai_nutritionist_tip.";
    }
    if (pregnancyStatus === "breastfeeding") {
      textPrompt +=
        "\n\nملاحظة سياق: المستخدمة مرضعة حالياً. راعِ هيك بنصيحتك (احتياج غذائي إضافي، سوائل).";
    }
    if (retrievedCorrections.length > 0) {
      textPrompt += `\n\nretrieved_corrections: ${JSON.stringify(retrievedCorrections)}`;
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
      system: WAJBTI_SYSTEM_PROMPT,
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
