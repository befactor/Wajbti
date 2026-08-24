/**
 * هاي النسخة الأولية (placeholder) لمحرك استرجاع التصحيحات.
 * حالياً بترجع مصفوفة فاضية دايماً - المشروع لسا ما وصل لقاعدة بيانات حقيقية.
 *
 * الخطوة الجاية (بعد ربط Supabase/Postgres):
 * 1. جدول "corrections": id, original_description, corrected_food_name,
 *    corrected_weight_g, note, created_at
 * 2. عند كل استدعاء، نعمل بحث نصي بسيط (ILIKE) أو نستخدم embeddings
 *    لإيجاد أقرب تصحيحات لنفس الوصف/الطبق.
 * 3. نرجع أفضل 3-5 نتائج بس (تفادي إطالة الـ prompt).
 */

export type Correction = {
  original_description: string;
  corrected_food_name: string;
  corrected_weight_g?: number;
  note?: string;
};

export async function findSimilarCorrections(params: {
  description: string;
}): Promise<Correction[]> {
  // TODO: اربطها بقاعدة البيانات الفعلية بعد إعداد Supabase
  // مثال مستقبلي:
  // const { data } = await supabase
  //   .from('corrections')
  //   .select('*')
  //   .textSearch('original_description', params.description)
  //   .limit(5);
  // return data ?? [];

  return [];
}

export async function saveCorrection(correction: Correction): Promise<void> {
  // TODO: اربطها بقاعدة البيانات - إدخال (insert) بجدول corrections
  console.log("Correction to save (not persisted yet):", correction);
}
