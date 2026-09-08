import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { registerSchema } from "@/validators/auth";
import { generateToken, EMAIL_VERIFICATION_TTL_MS } from "@/lib/token";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { allowed, retryAfterSeconds } = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }

    const parsed = registerSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { name, email, password, role } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 400 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
      },
    });

    const { raw, hash } = generateToken();
    await prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS) },
    });

    const verifyUrl = `${req.nextUrl.origin}/verify-email?token=${raw}`;
    const sent = await sendEmail({
      to: user.email,
      subject: "Verify your MaVeFaCo account",
      html: `
        <p>Hi ${user.name},</p>
        <p>Thanks for signing up for MaVeFaCo. Click the link below to verify your email address and activate your account. This link expires in 24 hours.</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>If you didn't create this account, you can safely ignore this email.</p>
      `,
    });
    if (!sent) console.error(`Failed to send verification email to user ${user.id}`);

    return NextResponse.json(
      {
        message: "Registration successful. Check your email to verify your account before logging in.",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
