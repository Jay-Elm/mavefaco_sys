import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { ROLES } from "@/lib/roles";
import { MFA_PENDING_COOKIE, verifyMfaPendingToken } from "@/lib/mfaToken";
import { verifyTotpCode } from "@/lib/totp";
import { decryptTotpSecret } from "@/lib/totpCrypto";
import { generateBackupCodes } from "@/lib/backupCodes";
import { issueSessionResponse } from "@/lib/session";
import { mfaConfirmSchema } from "@/validators/mfa";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { sendEmail } from "@/lib/email";

/**
 * POST /api/auth/mfa/confirm — completes first-time TOTP enrollment.
 * Verifies the code against the secret /setup just stored, flips
 * totpEnabled on, issues one-time backup codes, and — since this is the
 * tail end of the original login attempt — logs the user in for real.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { allowed, retryAfterSeconds } = rateLimit(`mfa-confirm:${ip}`, 10, 10 * 60 * 1000);
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
    if (!user.totpSecret)
      return NextResponse.json({ error: "Start setup again by scanning a new QR code." }, { status: 400 });

    const parsed = mfaConfirmSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const secret = decryptTotpSecret(user.totpSecret);
    const matchedStep = verifyTotpCode(parsed.data.code, secret);
    // matchedStep is always fresh here in practice (totpLastStep was just
    // reset by /setup), but the same "can't replay a step already spent"
    // rule applies for consistency with /verify.
    if (matchedStep === null || (user.totpLastStep !== null && matchedStep <= user.totpLastStep))
      return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 401 });

    const backupCodes = await generateBackupCodes();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { totpEnabled: true, totpLastStep: matchedStep },
      }),
      prisma.totpBackupCode.deleteMany({ where: { userId: user.id } }),
      prisma.totpBackupCode.createMany({
        data: backupCodes.map(({ hash }) => ({ userId: user.id, codeHash: hash })),
      }),
    ]);

    const notified = await sendEmail({
      to: user.email,
      subject: "Two-factor authentication enabled on your MaVeFaCo account",
      html: `
        <p>Hi ${user.name},</p>
        <p>Two-factor authentication was just turned on for your MaVeFaCo account (${user.email}).</p>
        <p>If this was you, no action is needed. If you didn't do this, your password may be compromised — contact another administrator immediately and change your password.</p>
      `,
    });
    if (!notified) console.error(`Failed to send MFA-enabled notification to user ${user.id}`);

    const response = issueSessionResponse(user, {
      message: "Two-factor authentication enabled",
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      backupCodes: backupCodes.map(({ code }) => code),
    });
    response.cookies.delete(MFA_PENDING_COOKIE);
    return response;
  } catch {
    return NextResponse.json({ error: "Failed to confirm two-factor setup" }, { status: 500 });
  }
}
