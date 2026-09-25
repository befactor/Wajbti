import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, dateStrToUTCMidnight, localDateStr } from "@/lib/date";

const MAX_DAYS = 31;

async function requireUserId() {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

// GET /api/stats/range?start=YYYY-MM-DD&days=7
// Per-day totals (one entry per day, zero-filled) for charts and the week strip.
export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const days = Math.min(MAX_DAYS, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 7));
  const startParam = req.nextUrl.searchParams.get("start");
  const start = startParam && /^\d{4}-\d{2}-\d{2}$/.test(startParam) ? startParam : addDays(localDateStr(), -(days - 1));
  const end = addDays(start, days - 1);
  const dateRange = { gte: dateStrToUTCMidnight(start), lte: dateStrToUTCMidnight(end) };

  const [mealSums, waterSums] = await Promise.all([
    prisma.mealEntry.groupBy({
      by: ["date"],
      where: { userId, date: dateRange },
      _sum: { totalCalories: true, totalProteinG: true, totalCarbsG: true, totalFatG: true },
    }),
    prisma.waterLog.groupBy({
      by: ["date"],
      where: { userId, date: dateRange },
      _sum: { amountMl: true },
    }),
  ]);

  const mealsByDate = new Map(mealSums.map((m) => [m.date.toISOString().slice(0, 10), m._sum]));
  const waterByDate = new Map(waterSums.map((w) => [w.date.toISOString().slice(0, 10), w._sum.amountMl ?? 0]));

  const result = Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i);
    const m = mealsByDate.get(date);
    return {
      date,
      logged: !!m,
      calories: Math.round(m?.totalCalories ?? 0),
      proteinG: Math.round(m?.totalProteinG ?? 0),
      carbsG: Math.round(m?.totalCarbsG ?? 0),
      fatG: Math.round(m?.totalFatG ?? 0),
      waterMl: waterByDate.get(date) ?? 0,
    };
  });

  return NextResponse.json({ days: result });
}
