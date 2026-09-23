import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ROLES } from "@/lib/roles";
import { MFA_PENDING_COOKIE, verifyMfaPendingToken } from "@/lib/mfaToken";
import { verifyTotpCode } from "@/lib/totp";
import { decryptTotpSecret } from "@/lib/totpCrypto";
import { normalizeBackupCode } from "@/lib/backupCodes";
import { issueSessionResponse } from "@/lib/session";
import { mfaVerifySchema } from "@/validators/mfa";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * POST /api/auth/mfa/verify — second step of login for an account that
 * already has TOTP enabled. Accepts a 6-digit TOTP code, or (if that
 * doesn't match) an unused backup code, either of which completes login.
 */
export async function POST(req: NextRequest) {
  try {
    const pendingToken = req.cookies.get(MFA_PENDING_COOKIE)?.value;
    const userId = pendingToken ? verifyMfaPendingToken(pendingToken, "verify") : null;
    if (!userId) return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });

    // Rate-limited per account (not just per IP) — the pending token already
    // proves the password was known, but a stolen/replayed pending token
    // shouldn't get unlimited code guesses either.
    const ip = getClientIp(req);
    const { allowed, retryAfterSeconds } = rateLimit(`mfa-verify:${ip}:${userId}`, 10, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.suspended || (user.role !== ROLES.ADMIN && user.role !== ROLES.MANAGER))
      return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });
    if (!user.totpEnabled || !user.totpSecret)
      return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });

    const parsed = mfaVerifySchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const secret = decryptTotpSecret(user.totpSecret);
    const matchedStep = verifyTotpCode(parsed.data.code, secret);
    // Reject a code whose step has already been spent — otherwise a code
    // captured in transit (or from a log) stays valid for anyone to
    // replay for the rest of its ~30-90s window.
    let ok =
      matchedStep !== null && (user.totpLastStep === null || matchedStep > user.totpLastStep);
    if (ok) {
      await prisma.user.update({ where: { id: user.id }, data: { totpLastStep: matchedStep } });
    }

    if (!ok) {
      const candidate = normalizeBackupCode(parsed.data.code);
      const unusedCodes = await prisma.totpBackupCode.findMany({
        where: { userId: user.id, usedAt: null },
      });
      for (const backupCode of unusedCodes) {
        if (await bcrypt.compare(candidate, backupCode.codeHash)) {
          await prisma.totpBackupCode.update({
            where: { id: backupCode.id },
            data: { usedAt: new Date() },
          });
          ok = true;
          break;
        }
      }
    }

    if (!ok) return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 401 });

    const response = issueSessionResponse(user, {
      message: "Login successful",
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
    response.cookies.delete(MFA_PENDING_COOKIE);
    return response;
  } catch {
    return NextResponse.json({ error: "Failed to verify code" }, { status: 500 });
  }
}
