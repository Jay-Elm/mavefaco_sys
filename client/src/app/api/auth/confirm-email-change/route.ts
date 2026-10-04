import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { confirmEmailChangeSchema } from "@/validators/auth";
import { hashToken } from "@/lib/token";
import { emailHtml, sendEmail } from "@/lib/email";

const INVALID = "This confirmation link is invalid or has expired. Request the change again from your profile.";

/**
 * POST /api/auth/confirm-email-change — the owner of the new address
 * clicked the link sent by PATCH /api/users/me. Switches the account's
 * email, logs out every session (tokenVersion), and tells the previous
 * address it happened.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { allowed, retryAfterSeconds } = rateLimit(`confirm-email-change:${ip}`, 10, 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }

    const parsed = confirmEmailChangeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const record = await prisma.emailChangeToken.findUnique({
      where: { tokenHash: hashToken(parsed.data.token) },
      include: { user: { select: { email: true, name: true, deletedAt: true } } },
    });
    if (!record || record.usedAt || record.expiresAt < new Date() || record.user.deletedAt) {
      return NextResponse.json({ error: INVALID }, { status: 400 });
    }

    const taken = await prisma.user.findUnique({ where: { email: record.newEmail }, select: { id: true } });
    if (taken && taken.id !== record.userId) {
      return NextResponse.json({ error: "That email address now belongs to another account." }, { status: 409 });
    }

    const outcome = await prisma.$transaction(async (tx) => {
      // Claim the token first, conditionally, so a double-click (or two
      // tabs) can't both apply it.
      const { count } = await tx.emailChangeToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (count === 0) return "used" as const;

      await tx.user.update({
        where: { id: record.userId },
        data: { email: record.newEmail, emailVerifiedAt: new Date(), tokenVersion: { increment: 1 } },
      });
      await tx.emailChangeToken.deleteMany({ where: { userId: record.userId, usedAt: null } });
      return "changed" as const;
    }).catch((err: unknown) => {
      // Someone registered the address between the check above and now.
      const code = typeof err === "object" && err !== null && "code" in err ? (err as { code: string }).code : null;
      if (code === "P2002") return "taken" as const;
      throw err;
    });

    if (outcome === "used") return NextResponse.json({ error: INVALID }, { status: 400 });
    if (outcome === "taken") {
      return NextResponse.json({ error: "That email address now belongs to another account." }, { status: 409 });
    }

    const notified = await sendEmail({
      to: record.user.email,
      subject: "Your MaVeFaCo email address was changed",
      html: emailHtml`
        <p>Hi ${record.user.name},</p>
        <p>The email address on your MaVeFaCo account was changed from ${record.user.email} to ${record.newEmail}, and every signed-in session was logged out.</p>
        <p>If you didn't do this, contact MaVeFaCo support at mavefaco@gmail.com right away.</p>
      `,
    });
    if (!notified) console.error(`Failed to send email-changed notice to the previous address of user ${record.userId}`);

    return NextResponse.json({ message: "Your email address has been changed. Sign in with your new address." });
  } catch (error) {
    console.error("confirm-email-change error:", error);
    return NextResponse.json({ error: "Failed to confirm email change" }, { status: 500 });
  }
}
