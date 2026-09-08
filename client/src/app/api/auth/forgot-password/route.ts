import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { forgotPasswordSchema } from "@/validators/auth";
import { generateResetToken, RESET_TOKEN_TTL_MS } from "@/lib/resetToken";
import { sendEmail } from "@/lib/email";

// Always the same response, whether or not the email is registered —
// telling the caller either way is a user-enumeration oracle.
const GENERIC_RESPONSE = {
  message: "If an account exists for that email, we've sent a password reset link.",
};

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { allowed, retryAfterSeconds } = rateLimit(`forgot-password:${ip}`, 5, 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }

    const parsed = forgotPasswordSchema.safeParse(await req.json());
    if (!parsed.success) {
      // Still generic — an invalid email format shouldn't behave
      // differently from a valid-but-unregistered one.
      return NextResponse.json(GENERIC_RESPONSE);
    }
    const { email } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const { raw, hash } = generateResetToken();

      await prisma.$transaction([
        // Invalidate any earlier unused links so only the latest request works.
        prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
        prisma.passwordResetToken.create({
          data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
        }),
      ]);

      const resetUrl = `${req.nextUrl.origin}/reset-password?token=${raw}`;
      const sent = await sendEmail({
        to: user.email,
        subject: "Reset your MaVeFaCo password",
        html: `
          <p>Hi ${user.name},</p>
          <p>Someone requested a password reset for your MaVeFaCo account. If this was you, click the link below to choose a new password. This link expires in 30 minutes.</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>
        `,
      });
      if (!sent) console.error(`Failed to send password reset email to user ${user.id}`);
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error("forgot-password error:", error);
    // Generic even on unexpected errors — same reasoning as above.
    return NextResponse.json(GENERIC_RESPONSE);
  }
}
