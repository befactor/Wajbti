import { prisma } from "@/lib/prisma";

export type Correction = {
  original_description: string;
  corrected_food_name: string;
};

/**
 * استرجاع بسيط (RAG) لأقرب تصحيحات سابقة: بحث نصي (ILIKE) عن كلمات مشتركة
 * بين الوصف الحالي وأوصاف سابقة صحّحها مستخدمون. كافٍ لحجم بيانات ناشئ؛
 * قابل للترقية لاحقاً لـ embeddings دون تغيير الواجهة (findSimilarCorrections).
 */
export async function findSimilarCorrections(params: {
  description: string;
}): Promise<Correction[]> {
  const description = params.description.trim();
  if (!description) return [];

  const words = description
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
    .slice(0, 6);

  if (words.length === 0) return [];

  const matches = await prisma.correction.findMany({
    where: {
      OR: words.map((word) => ({
        originalDescription: { contains: word, mode: "insensitive" as const },
      })),
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return matches.map((m) => ({
    original_description: m.originalDescription,
    corrected_food_name: m.correctedFoodName,
  }));
}

export async function saveCorrection(
  correction: Correction & { userId?: string }
): Promise<void> {
  await prisma.correction.create({
    data: {
      originalDescription: correction.original_description,
      correctedFoodName: correction.corrected_food_name,
      userId: correction.userId,
    },
  });
}
