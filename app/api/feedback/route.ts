import { NextRequest, NextResponse } from "next/server";
import { saveCorrection } from "@/lib/corrections";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { original_description, note } = body;

    await saveCorrection({
      original_description,
      corrected_food_name: note, // مبسّطة حالياً، تنقسم لاحقاً لحقول أدق
      note,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "فشل حفظ التصحيح" }, { status: 500 });
  }
}
