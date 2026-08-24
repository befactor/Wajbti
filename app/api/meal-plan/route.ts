import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MEAL_PLAN_SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { localDateStr, dateStrToUTCMidnight } from "@/lib/date";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function requireUserId() {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const plan = await prisma.mealPlan.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ plan });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile?.dailyCalorieTarget || !profile.goal) {
    return NextResponse.json(
      { error: "أكمل ملفك الشخصي أولاً عشان نحسب خطة مناسبة" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const days = Math.min(Math.max(Number(body.days) || 7, 1), 7);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: MEAL_PLAN_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `ابنِ خطة طعام لـ ${days} يوم/أيام.
targetCalories: ${Math.round(profile.dailyCalorieTarget)}
goal: ${profile.goal}
activityLevel: ${profile.activityLevel}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "{}";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const plan = await prisma.mealPlan.create({
      data: {
        userId,
        startDate: dateStrToUTCMidnight(localDateStr()),
        targetCalories: profile.dailyCalorieTarget,
        goal: profile.goal,
        days: parsed.days || [],
        notes: parsed.notes || null,
      },
    });

    return NextResponse.json({ plan });
  } catch (err) {
    console.error("Meal plan generation error:", err);
    return NextResponse.json({ error: "صار خطأ بتوليد الخطة، جرب مرة تانية" }, { status: 500 });
  }
}
