import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { loginSchema } from "@/validators/auth";
import { ROLES } from "@/lib/roles";
import { signMfaPendingToken, MFA_PENDING_COOKIE, mfaPendingCookieOptions } from "@/lib/mfaToken";
import { issueSessionResponse } from "@/lib/session";

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

    // Admin/manager accounts require TOTP — password alone doesn't complete
    // login. Issue a short-lived, purpose-scoped pending token instead of
    // the real session cookie; the client is routed to either confirm a
    // fresh enrollment (never set up TOTP yet) or verify an existing one.
    if (user.role === ROLES.ADMIN || user.role === ROLES.MANAGER) {
      const pendingToken = signMfaPendingToken(user.id, user.totpEnabled ? "verify" : "setup");
      const response = NextResponse.json(
        user.totpEnabled ? { mfaRequired: true } : { mfaSetupRequired: true },
      );
      response.cookies.set(MFA_PENDING_COOKIE, pendingToken, mfaPendingCookieOptions);
      return response;
    }

    return issueSessionResponse(user, {
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
