import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireUserId() {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function PUT(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json();
  const dailyGoalMl = Number(body.dailyGoalMl);
  const reminderCount = Number(body.reminderCount);
  const startHour = Number(body.startHour);
  const endHour = Number(body.endHour);
  const remindersEnabled = Boolean(body.remindersEnabled);

  // startHour > endHour is allowed on purpose - it means an overnight window
  // (e.g. Ramadan: iftar at 19 to suhoor cutoff at 4), handled by the
  // wraparound math in the reminder scheduler.
  if (
    !dailyGoalMl ||
    dailyGoalMl <= 0 ||
    reminderCount <= 0 ||
    startHour < 0 ||
    startHour > 23 ||
    endHour < 0 ||
    endHour > 23 ||
    startHour === endHour
  ) {
    return NextResponse.json({ error: "إعدادات غير صحيحة" }, { status: 400 });
  }

  const settings = await prisma.waterSettings.upsert({
    where: { userId },
    create: { userId, dailyGoalMl, reminderCount, startHour, endHour, remindersEnabled },
    update: { dailyGoalMl, reminderCount, startHour, endHour, remindersEnabled },
  });

  return NextResponse.json({ settings });
}
