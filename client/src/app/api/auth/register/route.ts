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

    // Same response (status, shape, and roughly the same amount of work)
    // whether or not the email is already registered — a differing
    // response here is exactly what lets an attacker enumerate which
    // emails have accounts. The two branches below notify by email
    // instead of by API response, matching how login already avoids this
    // with its generic "Invalid credentials".
    if (existingUser) {
      // Dummy hash so this branch costs roughly what the real signup path
      // costs (bcrypt.hash is the dominant fixed cost there) — narrows,
      // though doesn't eliminate, the timing gap between the two branches.
      await bcrypt.hash(password, 10);

      const sent = await sendEmail({
        to: existingUser.email,
        subject: "Someone tried to register with your email",
        html: `
          <p>Hi ${existingUser.name},</p>
          <p>Someone just tried to create a new MaVeFaCo account using this email address, but you already have one.</p>
          <p>If this was you, you can <a href="${req.nextUrl.origin}/login">log in</a> normally, or <a href="${req.nextUrl.origin}/forgot-password">reset your password</a> if you've forgotten it.</p>
          <p>If you don't recognize this, you can safely ignore this email — no changes were made to your account.</p>
        `,
      });
      if (!sent) console.error(`Failed to send duplicate-registration notice to user ${existingUser.id}`);

      return NextResponse.json(
        { message: "Registration successful. Check your email to verify your account before logging in." },
        { status: 201 },
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
      { message: "Registration successful. Check your email to verify your account before logging in." },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
