import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateStrToUTCMidnight, localDateStr } from "@/lib/date";
import {
  ActivityLevel,
  Goal,
  PregnancyStatus,
  Sex,
  calculateBMR,
  calculateTDEE,
  calculateDailyCalorieTarget,
  calculateDailyWaterTargetMl,
} from "@/lib/nutrition";

async function requireUserId() {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const logs = await prisma.weightLog.findMany({
    where: { userId },
    orderBy: { date: "asc" },
    take: 60,
  });

  return NextResponse.json({ logs });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const weightKg = Number(body.weightKg);
  const dateStr = body.date || localDateStr();

  if (!weightKg || weightKg <= 0 || weightKg > 400) {
    return NextResponse.json({ error: "وزن غير صحيح" }, { status: 400 });
  }

  const date = dateStrToUTCMidnight(dateStr);

  const [log, profile, mostRecentLog] = await Promise.all([
    prisma.weightLog.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, weightKg },
      update: { weightKg },
    }),
    prisma.profile.findUnique({ where: { userId } }),
    prisma.weightLog.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
  ]);

  // Only let this entry drive the profile's "current" weight (and the BMR/
  // TDEE recompute) if it's the most recent one on record - a backdated
  // weigh-in logged after a newer one shouldn't regress the live profile.
  const isMostRecent = !mostRecentLog || mostRecentLog.date <= date;

  let updatedProfile = profile;
  if (isMostRecent && profile?.sex && profile.ageYears && profile.heightCm && profile.activityLevel && profile.goal) {
    const bmr = calculateBMR({
      sex: profile.sex as Sex,
      weightKg,
      heightCm: profile.heightCm,
      ageYears: profile.ageYears,
    });
    const tdee = calculateTDEE(bmr, profile.activityLevel as ActivityLevel);
    const dailyCalorieTarget = calculateDailyCalorieTarget(
      tdee,
      profile.goal as Goal,
      profile.pregnancyStatus as PregnancyStatus
    );
    const dailyWaterTargetMl = calculateDailyWaterTargetMl(weightKg, profile.activityLevel as ActivityLevel);

    updatedProfile = await prisma.profile.update({
      where: { userId },
      data: { weightKg, bmr, tdee, dailyCalorieTarget, dailyWaterTargetMl },
    });

    await prisma.waterSettings.upsert({
      where: { userId },
      create: { userId, dailyGoalMl: dailyWaterTargetMl },
      update: { dailyGoalMl: dailyWaterTargetMl },
    });
  }

  return NextResponse.json({ log, profile: updatedProfile });
}
