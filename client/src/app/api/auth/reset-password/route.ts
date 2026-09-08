import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { resetPasswordSchema } from "@/validators/auth";
import { hashToken } from "@/lib/token";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { allowed, retryAfterSeconds } = rateLimit(`reset-password:${ip}`, 10, 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }

    const parsed = resetPasswordSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { token, newPassword } = parsed.data;

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { emailVerifiedAt: true } } },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Please request a new one." },
        { status: 400 },
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: {
          password: hashedPassword,
          tokenVersion: { increment: 1 },
          // Successfully receiving and clicking this link proves ownership
          // of the inbox just as well as clicking a verification link
          // would — don't make someone verify twice.
          ...(record.user.emailVerifiedAt === null && { emailVerifiedAt: new Date() }),
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    console.error("reset-password error:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
