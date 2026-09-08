import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { updateProfileSchema, changePasswordSchema } from "@/validators/profile";

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

    const profileParsed = updateProfileSchema.safeParse(body);
    if (!profileParsed.success) {
      return NextResponse.json({ error: profileParsed.error.issues[0].message }, { status: 400 });
    }
    const { name, email } = profileParsed.data;

    const hasPasswordFields = body.currentPassword !== undefined || body.newPassword !== undefined;
    let currentPassword: string | undefined;
    let newPassword: string | undefined;
    if (hasPasswordFields) {
      const pwParsed = changePasswordSchema.safeParse(body);
      if (!pwParsed.success) {
        return NextResponse.json({ error: pwParsed.error.issues[0].message }, { status: 400 });
      }
      ({ currentPassword, newPassword } = pwParsed.data);
    }

    if (!name && !email && !newPassword)
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== actor.id)
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    let hashedPassword: string | undefined;
    if (newPassword && currentPassword) {
      const dbUser = await prisma.user.findUnique({ where: { id: actor.id }, select: { password: true } });
      const match = dbUser && await bcrypt.compare(currentPassword, dbUser.password);
      if (!match)
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      hashedPassword = await bcrypt.hash(newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: actor.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(hashedPassword && { password: hashedPassword, tokenVersion: { increment: 1 } }),
      },
      select: { id: true, name: true, email: true, role: true, verified: true },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
