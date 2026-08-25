import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeStreak } from "@/lib/date";

async function requireUserId() {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const entries = await prisma.mealEntry.findMany({
    where: { userId },
    select: { date: true },
    distinct: ["date"],
    orderBy: { date: "desc" },
    take: 120, // more than enough for any realistic streak
  });

  const dateStrs = entries.map((e) => e.date.toISOString().slice(0, 10));
  const streak = computeStreak(dateStrs);

  return NextResponse.json({ streak });
}
