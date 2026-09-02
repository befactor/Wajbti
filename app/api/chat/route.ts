import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NUTRITIONIST_CHAT_SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { dateStrToUTCMidnight, localDateStr } from "@/lib/date";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const HISTORY_LIMIT = 20;

async function requireUserId() {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const messages = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return NextResponse.json({ messages });
}

async function buildUserContext(userId: string, foodNotes: string[]): Promise<string> {
  const [profile, todayMeals] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.mealEntry.findMany({
      where: { userId, date: dateStrToUTCMidnight(localDateStr()) },
    }),
  ]);

  const lines: string[] = [];

  if (profile) {
    if (profile.ageYears) lines.push(`العمر: ${profile.ageYears}`);
    if (profile.sex) lines.push(`الجنس: ${profile.sex === "male" ? "ذكر" : "أنثى"}`);
    if (profile.weightKg) lines.push(`الوزن: ${profile.weightKg} كغ`);
    if (profile.heightCm) lines.push(`الطول: ${profile.heightCm} سم`);
    if (profile.goal) lines.push(`الهدف: ${profile.goal}`);
    if (profile.pregnancyStatus === "pregnant") lines.push("المستخدمة حامل حالياً - راعِ ذلك بالنصائح الغذائية وحذّرها بلطف من أي أطعمة غير آمنة بالحمل لو مرتبطة بسؤالها.");
    if (profile.pregnancyStatus === "breastfeeding") lines.push("المستخدمة مرضعة حالياً - راعِ احتياجها الغذائي الإضافي بالنصائح.");
    if (profile.tdee) lines.push(`احتياجه اليومي (TDEE): ${Math.round(profile.tdee)} kcal`);
    if (profile.dailyCalorieTarget)
      lines.push(`هدف السعرات اليومي: ${Math.round(profile.dailyCalorieTarget)} kcal`);
    if (profile.ramadanMode) lines.push("وضع رمضان مفعّل حالياً");
  } else {
    lines.push("لم يُكمل المستخدم ملفه الشخصي بعد (دون بيانات BMR/TDEE دقيقة)");
  }

  if (todayMeals.length > 0) {
    const consumed = todayMeals.reduce((s, m) => s + m.totalCalories, 0);
    lines.push(`سعرات مستهلكة اليوم لحد الآن: ${Math.round(consumed)} kcal عبر ${todayMeals.length} وجبة/وجبات مسجّلة`);
  } else {
    lines.push("لم يُسجّل أي وجبة اليوم حتى الآن");
  }

  if (foodNotes.length > 0) {
    lines.push(`known_food_notes: ${JSON.stringify(foodNotes)}`);
  }

  return lines.join("\n");
}

// Pulls any "[FOOD_NOTE: ...]" sentinel lines the model tucked into its
// reply, strips them from the text the user actually sees, and returns
// the extracted notes separately so the caller can persist them.
function extractFoodNotes(replyText: string): { cleanedText: string; notes: string[] } {
  const notes: string[] = [];
  const cleanedText = replyText
    .replace(/\[FOOD_NOTE:\s*([^\]]+)\]/g, (_match, note: string) => {
      notes.push(note.trim());
      return "";
    })
    .trim();
  return { cleanedText, notes };
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message = (body.message || "").trim();
  if (!message) return NextResponse.json({ error: "الرسالة فاضية" }, { status: 400 });

  try {
    const [history, existingNotes] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
      }),
      prisma.foodNote.findMany({ where: { userId }, select: { note: true } }),
    ]);
    const orderedHistory = history.reverse();
    const userContext = await buildUserContext(
      userId,
      existingNotes.map((n) => n.note)
    );

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      // Split so the static instructions (identical for every user, every
      // request) are cached separately from the per-user context, which
      // changes every call and would otherwise bust the cache each time.
      system: [
        { type: "text", text: NUTRITIONIST_CHAT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        { type: "text", text: `user_context:\n${userContext}` },
      ],
      messages: [
        ...orderedHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: message },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const rawReply = textBlock && "text" in textBlock ? textBlock.text : "";
    const { cleanedText: replyText, notes: newNotes } = extractFoodNotes(rawReply);

    const [userMsg, assistantMsg] = await prisma.$transaction([
      prisma.chatMessage.create({ data: { userId, role: "user", content: message } }),
      prisma.chatMessage.create({ data: { userId, role: "assistant", content: replyText } }),
    ]);

    const existingNoteTexts = new Set(existingNotes.map((n) => n.note.trim().toLowerCase()));
    const notesToSave = newNotes.filter((n) => n && !existingNoteTexts.has(n.trim().toLowerCase()));
    if (notesToSave.length > 0) {
      await prisma.foodNote.createMany({
        data: notesToSave.map((note) => ({ userId, note, source: "chat" })),
      });
    }

    return NextResponse.json({ userMessage: userMsg, assistantMessage: assistantMsg });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json({ error: "صار خطأ، جرب مرة تانية" }, { status: 500 });
  }
}
