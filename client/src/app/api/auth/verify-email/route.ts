import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { verifyEmailSchema } from "@/validators/auth";
import { hashToken } from "@/lib/token";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { allowed, retryAfterSeconds } = rateLimit(`verify-email:${ip}`, 10, 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }

    const parsed = verifyEmailSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { token } = parsed.data;

    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This verification link is invalid or has expired. Please request a new one." },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ message: "Email verified. You can now log in." });
  } catch (error) {
    console.error("verify-email error:", error);
    return NextResponse.json({ error: "Failed to verify email" }, { status: 500 });
  }
}
