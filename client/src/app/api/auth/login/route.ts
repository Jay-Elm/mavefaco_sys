import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { loginSchema } from "@/validators/auth";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const { allowed, retryAfterSeconds } = rateLimit(`login:${ip}`, 10, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }

    const parsed = loginSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    if (user.suspended) {
      return NextResponse.json(
        { error: "Your account has been suspended. Contact an administrator." },
        { status: 403 },
      );
    }

    if (!user.emailVerifiedAt) {
      return NextResponse.json(
        { error: "Please verify your email before logging in.", code: "EMAIL_NOT_VERIFIED" },
        { status: 403 },
      );
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tokenVersion: user.tokenVersion,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "7d",
      },
    );

    const response = NextResponse.json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    // httpOnly so client-side JS (and any XSS) can never read the token;
    // SameSite=Lax blocks it from being sent on cross-site requests (CSRF)
    // while still allowing normal top-level navigation to the site.
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
