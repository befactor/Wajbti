import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateStrToUTCMidnight, localDateStr } from "@/lib/date";

const DEFAULT_GOAL_ML = 2000;

async function requireUserId() {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const dateStr = req.nextUrl.searchParams.get("date") || localDateStr();
  const date = dateStrToUTCMidnight(dateStr);

  const [settings, logs] = await Promise.all([
    prisma.waterSettings.findUnique({ where: { userId } }),
    prisma.waterLog.findMany({ where: { userId, date }, orderBy: { createdAt: "asc" } }),
  ]);

  const totalMl = logs.reduce((sum, l) => sum + l.amountMl, 0);

  return NextResponse.json({
    date: dateStr,
    settings: settings || {
      dailyGoalMl: DEFAULT_GOAL_ML,
      remindersEnabled: true,
      reminderCount: 6,
      startHour: 8,
      endHour: 22,
    },
    logs,
    totalMl,
  });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json();
  const amountMl = Number(body.amountMl);
  const dateStr = body.date || localDateStr();

  if (!amountMl || amountMl <= 0) {
    return NextResponse.json({ error: "كمية غير صحيحة" }, { status: 400 });
  }

  const log = await prisma.waterLog.create({
    data: { userId, date: dateStrToUTCMidnight(dateStr), amountMl },
  });

  return NextResponse.json({ log });
}
