import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ActivityLevel,
  Goal,
  PregnancyStatus,
  Sex,
  calculateBMR,
  calculateTDEE,
  calculateBMI,
  classifyBMI,
  calculateDailyCalorieTarget,
  calculateDailyWaterTargetMl,
} from "@/lib/nutrition";

const VALID_PREGNANCY_STATUSES: PregnancyStatus[] = ["none", "pregnant", "breastfeeding"];

async function requireUserId() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  return userId ?? null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId } });
  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json();
  const sex = body.sex as Sex;
  const ageYears = Number(body.ageYears);
  const heightCm = Number(body.heightCm);
  const weightKg = Number(body.weightKg);
  const activityLevel = body.activityLevel as ActivityLevel;
  const goal = body.goal as Goal;
  const ramadanMode = Boolean(body.ramadanMode);
  const pregnancyStatusRaw = body.pregnancyStatus as PregnancyStatus;
  // Only meaningful for female profiles - anything else is normalized to "none".
  const pregnancyStatus: PregnancyStatus =
    sex === "female" && VALID_PREGNANCY_STATUSES.includes(pregnancyStatusRaw)
      ? pregnancyStatusRaw
      : "none";

  if (
    !sex ||
    !ageYears ||
    !heightCm ||
    !weightKg ||
    !activityLevel ||
    !goal ||
    ageYears <= 0 ||
    heightCm <= 0 ||
    weightKg <= 0
  ) {
    return NextResponse.json({ error: "البيانات المدخلة غير مكتملة أو غير صحيحة" }, { status: 400 });
  }

  const bmr = calculateBMR({ sex, weightKg, heightCm, ageYears });
  const tdee = calculateTDEE(bmr, activityLevel);
  const dailyCalorieTarget = calculateDailyCalorieTarget(tdee, goal, pregnancyStatus);
  const dailyWaterTargetMl = calculateDailyWaterTargetMl(weightKg, activityLevel);
  const bmi = calculateBMI(weightKg, heightCm);
  const bmiCategory = classifyBMI(bmi);

  const profile = await prisma.profile.upsert({
    where: { userId },
    create: {
      userId,
      sex,
      ageYears,
      heightCm,
      weightKg,
      activityLevel,
      goal,
      pregnancyStatus,
      bmr,
      tdee,
      dailyCalorieTarget,
      dailyWaterTargetMl,
      ramadanMode,
    },
    update: {
      sex,
      ageYears,
      heightCm,
      weightKg,
      activityLevel,
      goal,
      pregnancyStatus,
      bmr,
      tdee,
      dailyCalorieTarget,
      dailyWaterTargetMl,
      ramadanMode,
    },
  });

  // Keep the water reminder goal in sync with the freshly computed target.
  await prisma.waterSettings.upsert({
    where: { userId },
    create: { userId, dailyGoalMl: dailyWaterTargetMl },
    update: { dailyGoalMl: dailyWaterTargetMl },
  });

  return NextResponse.json({ profile, bmi, bmiCategory });
}
