import { NextRequest, NextResponse } from "next/server";
import { saveCorrection } from "@/lib/corrections";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { original_description, corrected_food_name } = body;

    if (!original_description || !corrected_food_name) {
      return NextResponse.json(
        { error: "لازم توفر original_description و corrected_food_name" },
        { status: 400 }
      );
    }

    await saveCorrection({
      original_description,
      corrected_food_name,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "فشل حفظ التصحيح" }, { status: 500 });
  }
}
