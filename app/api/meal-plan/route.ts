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
    let userPrompt = `ابنِ خطة طعام لـ ${days} يوم/أيام.
targetCalories: ${Math.round(profile.dailyCalorieTarget)}
goal: ${profile.goal}
activityLevel: ${profile.activityLevel}`;

    if (profile.pregnancyStatus === "pregnant") {
      userPrompt +=
        "\n\nملاحظة مهمة: المستخدمة حامل حالياً. تجنّب أي اقتراح لأطعمة غير آمنة بالحمل (بيض نيء/سائل، لحم أو سمك نيء أو غير مطبوخ جيداً، أجبان غير مبسترة، كبد بكميات كبيرة). ركّز على أطعمة غنية بالحديد والكالسيوم والألياف.";
    }
    if (profile.pregnancyStatus === "breastfeeding") {
      userPrompt +=
        "\n\nملاحظة مهمة: المستخدمة مرضعة حالياً. راعِ احتياجها الغذائي الإضافي وركّز على أطعمة غنية بالبروتين والسوائل والكالسيوم.";
    }

    if (profile.ramadanMode) {
      userPrompt +=
        "\n\nملاحظة مهمة: المستخدم صايم (وضع رمضان مفعّل). ابنِ الخطة على وجبتين فقط بكل يوم: \"سحور\" و\"إفطار\" (بدل الوجبات العادية)، ووزّع نفس السعرات المستهدفة عليهم بس بشكل يراعي الصيام: إفطار يبدأ بشي خفيف (تمر وماء/لبن) بعده الوجبة الرئيسية، وسحور يركز على بروتين وألياف تساعد الشبع لفترة الصيام. استخدم قيمة slot تساوي \"suhoor\" أو \"iftar\" فقط بدل breakfast/lunch/dinner/snack.";
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      // A full 7-day plan (4 meals/day with macros) runs well past 3000
      // tokens as JSON; too low a ceiling here silently truncates the
      // response and breaks JSON.parse below.
      max_tokens: 8000,
      system: MEAL_PLAN_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    if (response.stop_reason === "max_tokens") {
      console.error("Meal plan generation truncated at max_tokens");
      return NextResponse.json(
        { error: "الخطة طويلة كتير وانقطع الرد، جرب تولّد خطة بأيام أقل" },
        { status: 500 }
      );
    }

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
