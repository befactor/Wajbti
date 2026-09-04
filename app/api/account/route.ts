import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Apple's App Review guideline 5.1.1(v) requires apps that support in-app
// account creation to also let users delete their account from within the
// app, not just by emailing support. Every relation on User cascades on
// delete in the schema, so one prisma.user.delete() is enough to remove all
// of the account's data (meals, logs, favorites, conversations, etc).
export async function DELETE() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ ok: true });
}
