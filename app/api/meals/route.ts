import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateStrToUTCMidnight, localDateStr } from "@/lib/date";

const SLOTS = ["breakfast", "lunch", "dinner", "snack", "suhoor", "iftar"];

async function requireUserId() {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const dateStr = req.nextUrl.searchParams.get("date") || localDateStr();
  const date = dateStrToUTCMidnight(dateStr);

  const meals = await prisma.mealEntry.findMany({
    where: { userId, date },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ date: dateStr, meals });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json();
  const { slot, description, inputType, items, totals, aiTip, swapSuggestion, diningContext } = body;
  const dateStr = body.date || localDateStr();

  if (!slot || !SLOTS.includes(slot) || !totals || typeof totals.calories !== "number") {
    return NextResponse.json({ error: "بيانات الوجبة غير مكتملة" }, { status: 400 });
  }

  const meal = await prisma.mealEntry.create({
    data: {
      userId,
      date: dateStrToUTCMidnight(dateStr),
      slot,
      description: description || null,
      inputType: inputType || "text",
      items: items || [],
      totalCalories: totals.calories,
      totalProteinG: totals.protein_g ?? 0,
      totalCarbsG: totals.carbs_g ?? 0,
      totalFatG: totals.fat_g ?? 0,
      totalFiberG: totals.fiber_g ?? null,
      totalSugarG: totals.sugar_g ?? null,
      totalSodiumMg: totals.sodium_mg ?? null,
      aiTip: aiTip || null,
      swapSuggestion: swapSuggestion || null,
      diningContext: diningContext || null,
    },
  });

  return NextResponse.json({ meal });
}
