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

type PlanMeal = {
  slot: string;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};
type PlanDay = { meals?: PlanMeal[] };

export async function PATCH(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dayIndex = Number(body.dayIndex);
  const slot = typeof body.slot === "string" ? body.slot : "";
  const completed = Boolean(body.completed);
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || !slot) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const plan = await prisma.mealPlan.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  if (!plan) return NextResponse.json({ error: "ما في خطة حالياً" }, { status: 404 });

  const days = (plan.days as unknown as PlanDay[]) || [];
  const meal = days[dayIndex]?.meals?.find((m) => m.slot === slot);
  if (!meal) return NextResponse.json({ error: "الوجبة غير موجودة بالخطة" }, { status: 404 });

  const key = `${dayIndex}-${slot}`;
  const current = ((plan.completedMeals as unknown as string[]) || []).filter((k) => k !== key);
  const nextCompleted = completed ? [...current, key] : current;

  // Checking a meal off is a "the user actually did and liked this" signal -
  // fold it into their standing taste profile so future plans (and quick
  // re-logging from the diary) lean on it, without needing to ask again.
  if (completed) {
    const alreadyFavorited = await prisma.favoriteMeal.findFirst({
      where: { userId, foodName: meal.food_name },
    });
    if (!alreadyFavorited) {
      await prisma.favoriteMeal.create({
        data: {
          userId,
          foodName: meal.food_name,
          items: [{ food_name: meal.food_name }],
          totalCalories: meal.calories ?? 0,
          totalProteinG: meal.protein_g ?? 0,
          totalCarbsG: meal.carbs_g ?? 0,
          totalFatG: meal.fat_g ?? 0,
        },
      });
    }
  }

  const updatedPlan = await prisma.mealPlan.update({
    where: { id: plan.id },
    data: { completedMeals: nextCompleted },
  });

  return NextResponse.json({ plan: updatedPlan });
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
  const force = Boolean(body.force);
  const preferences = typeof body.preferences === "string" ? body.preferences.trim().slice(0, 300) : "";

  // The plan is meant to stay fixed for a week - re-generating it on every
  // click burns a full (expensive) API call for a near-identical result.
  // Only regenerate early if the caller explicitly asks for a new plan.
  const existingPlan = await prisma.mealPlan.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const existingPlanIsCurrent =
    existingPlan && Date.now() - existingPlan.startDate.getTime() < oneWeekMs;
  if (existingPlanIsCurrent && !force) {
    return NextResponse.json({ plan: existingPlan, reused: true });
  }

  try {
    const favorites = await prisma.favoriteMeal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { foodName: true },
    });

    let userPrompt = `ابنِ خطة طعام لـ ${days} يوم/أيام.
targetCalories: ${Math.round(profile.dailyCalorieTarget)}
goal: ${profile.goal}
activityLevel: ${profile.activityLevel}`;

    if (favorites.length > 0) {
      userPrompt += `\nfavorite_meals: ${JSON.stringify(favorites.map((f) => f.foodName))}`;
    }

    if (preferences) {
      userPrompt += `\n\nتفضيلات المستخدم لهاي الخطة تحديداً (بالإضافة لأكلاته المفضلة المذكورة فوق لو في): ${preferences}`;
    }

    const keepMeals = Array.isArray(body.keepMeals)
      ? body.keepMeals.filter((m: unknown): m is string => typeof m === "string").slice(0, 20)
      : [];
    if (keepMeals.length > 0) {
      userPrompt += `\n\nأكلات من خطة الأسبوع الماضي حاب المستخدم يثبتها بالخطة الجديدة (كرّرها كما هي بنفس الوجبات المناسبة، ما تبدلها): ${JSON.stringify(keepMeals)}`;
    }

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
      // Cached: same prompt for every plan generation regardless of user.
      system: [{ type: "text", text: MEAL_PLAN_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
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
