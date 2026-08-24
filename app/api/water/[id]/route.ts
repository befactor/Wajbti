import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireUserId() {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const log = await prisma.waterLog.findUnique({ where: { id: params.id } });
  if (!log || log.userId !== userId) {
    return NextResponse.json({ error: "السجل غير موجود" }, { status: 404 });
  }

  await prisma.waterLog.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
