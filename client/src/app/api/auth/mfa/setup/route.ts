import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { ROLES } from "@/lib/roles";
import { MFA_PENDING_COOKIE, verifyMfaPendingToken } from "@/lib/mfaToken";
import { generateTotpSecret, totpQrCodeDataUrl } from "@/lib/totp";
import { encryptTotpSecret } from "@/lib/totpCrypto";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * POST /api/auth/mfa/setup — called right after login returns
 * `mfaSetupRequired`. Generates a fresh TOTP secret, stores it (encrypted,
 * not yet enabled), and returns a QR code for the user's authenticator app.
 * Safe to call again before /confirm (e.g. the user reloads the page) —
 * each call simply overwrites the not-yet-confirmed secret.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { allowed, retryAfterSeconds } = rateLimit(`mfa-setup:${ip}`, 10, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }

    const pendingToken = req.cookies.get(MFA_PENDING_COOKIE)?.value;
    const userId = pendingToken ? verifyMfaPendingToken(pendingToken, "setup") : null;
    if (!userId) return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.suspended || (user.role !== ROLES.ADMIN && user.role !== ROLES.MANAGER))
      return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });
    if (user.totpEnabled)
      return NextResponse.json({ error: "Two-factor authentication is already set up." }, { status: 400 });

    const secret = generateTotpSecret();
    // totpLastStep is reset here too — a step number from a previous
    // (never-confirmed) secret has no meaning against this new one.
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: encryptTotpSecret(secret), totpLastStep: null },
    });

    const qrCodeDataUrl = await totpQrCodeDataUrl(user.email, secret);

    return NextResponse.json({ secret, qrCodeDataUrl });
  } catch {
    return NextResponse.json({ error: "Failed to start two-factor setup" }, { status: 500 });
  }
}
