import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, name: true, email: true, role: true, idImagePath: true, verified: true, createdAt: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // The storage path is an internal detail — the client only needs to
    // know whether an ID has been submitted, never the raw path itself.
    const { idImagePath, ...rest } = user;
    return NextResponse.json({ ...rest, hasIdImage: idImagePath !== null });
  } catch {
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, email, currentPassword, newPassword } = body;

    const hasPasswordChange = typeof currentPassword === "string" && typeof newPassword === "string";

    if (!name && !email && !hasPasswordChange)
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== actor.id)
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    let hashedPassword: string | undefined;
    if (hasPasswordChange) {
      if (newPassword.length < 12)
        return NextResponse.json({ error: "New password must be at least 12 characters" }, { status: 400 });
      const dbUser = await prisma.user.findUnique({ where: { id: actor.id }, select: { password: true } });
      const match = dbUser && await bcrypt.compare(currentPassword, dbUser.password);
      if (!match)
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      hashedPassword = await bcrypt.hash(newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: actor.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(email && { email: email.trim().toLowerCase() }),
        ...(hashedPassword && { password: hashedPassword, tokenVersion: { increment: 1 } }),
      },
      select: { id: true, name: true, email: true, role: true, verified: true },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
