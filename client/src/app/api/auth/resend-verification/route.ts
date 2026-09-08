import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { resendVerificationSchema } from "@/validators/auth";
import { generateToken, EMAIL_VERIFICATION_TTL_MS } from "@/lib/token";
import { sendEmail } from "@/lib/email";

// Always the same response, whether or not the email is registered or
// already verified — same anti-enumeration reasoning as forgot-password.
const GENERIC_RESPONSE = {
  message: "If that email needs verifying, we've sent a new link.",
};

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { allowed, retryAfterSeconds } = rateLimit(`resend-verification:${ip}`, 5, 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }

    const parsed = resendVerificationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(GENERIC_RESPONSE);
    }
    const { email } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt) {
      const { raw, hash } = generateToken();

      await prisma.$transaction([
        prisma.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
        prisma.emailVerificationToken.create({
          data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS) },
        }),
      ]);

      const verifyUrl = `${req.nextUrl.origin}/verify-email?token=${raw}`;
      const sent = await sendEmail({
        to: user.email,
        subject: "Verify your MaVeFaCo account",
        html: `
          <p>Hi ${user.name},</p>
          <p>Click the link below to verify your email address and activate your account. This link expires in 24 hours.</p>
          <p><a href="${verifyUrl}">${verifyUrl}</a></p>
          <p>If you didn't create this account, you can safely ignore this email.</p>
        `,
      });
      if (!sent) console.error(`Failed to resend verification email to user ${user.id}`);
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error("resend-verification error:", error);
    return NextResponse.json(GENERIC_RESPONSE);
  }
}
