import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        { error: "weakPasswordError" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "emailTakenError" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name: name || null, email, passwordHash },
    });

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (err) {
    // Two near-simultaneous submits (double-tap, or a retry after a slow
    // connection) can both pass the findUnique check above before either
    // insert lands - the second one then hits the DB's unique constraint
    // instead of the pre-check, so it needs its own mapping to the same
    // "email already registered" message rather than falling through to
    // a generic, unhelpful error.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "emailTakenError" }, { status: 409 });
    }
    console.error("Register error:", err);
    return NextResponse.json({ error: "genericError" }, { status: 500 });
  }
}
