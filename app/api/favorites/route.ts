import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireUserId() {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const favorites = await prisma.favoriteMeal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { foodName, items, totals } = body;

  if (!foodName || !totals || typeof totals.calories !== "number") {
    return NextResponse.json({ error: "بيانات الوجبة غير مكتملة" }, { status: 400 });
  }

  const favorite = await prisma.favoriteMeal.create({
    data: {
      userId,
      foodName,
      items: items || [],
      totalCalories: totals.calories,
      totalProteinG: totals.protein_g ?? 0,
      totalCarbsG: totals.carbs_g ?? 0,
      totalFatG: totals.fat_g ?? 0,
      totalFiberG: totals.fiber_g ?? null,
      totalSugarG: totals.sugar_g ?? null,
      totalSodiumMg: totals.sodium_mg ?? null,
    },
  });

  return NextResponse.json({ favorite });
}
