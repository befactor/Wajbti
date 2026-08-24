import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { WAJBTI_SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { findSimilarCorrections } from "@/lib/corrections";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// POST body: { description?: string, imageBase64?: string, mediaType?: string, voiceNote?: string, userId?: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { description, imageBase64, mediaType, voiceNote, userId } = body;

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
    if (retrievedCorrections.length > 0) {
      textPrompt += `\n\nretrieved_corrections: ${JSON.stringify(retrievedCorrections)}`;
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

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("Wajbti analyze error:", err);
    return NextResponse.json(
      { error: "صار خطأ بالتحليل، جرب مرة تانية" },
      { status: 500 }
    );
  }
}
