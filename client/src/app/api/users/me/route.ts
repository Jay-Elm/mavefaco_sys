import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { updateProfileSchema, changePasswordSchema, currentPasswordSchema } from "@/validators/profile";
import { deleteUserAccount } from "@/lib/deleteAccount";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { ROLES } from "@/lib/roles";
import { emailHtml, sendEmail } from "@/lib/email";
import { generateToken, EMAIL_CHANGE_TTL_MS } from "@/lib/token";

export async function GET(req: NextRequest) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, name: true, email: true, role: true, idImagePath: true, verified: true, createdAt: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // The storage path is an internal detail — the client only needs to
    // know whether an ID has been submitted, never the raw path itself.
    const { idImagePath, ...rest } = user;
    return NextResponse.json({ ...rest, hasIdImage: idImagePath !== null });
  } catch {
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    const profileParsed = updateProfileSchema.safeParse(body);
    if (!profileParsed.success) {
      return NextResponse.json({ error: profileParsed.error.issues[0].message }, { status: 400 });
    }
    const { name, email } = profileParsed.data;

    const settingNewPassword = body.newPassword !== undefined;

    let currentPassword: string | undefined;
    let newPassword: string | undefined;
    if (settingNewPassword) {
      const pwParsed = changePasswordSchema.safeParse(body);
      if (!pwParsed.success) {
        return NextResponse.json({ error: pwParsed.error.issues[0].message }, { status: 400 });
      }
      ({ currentPassword, newPassword } = pwParsed.data);
    }

    const dbUser = await prisma.user.findUnique({ where: { id: actor.id }, select: { email: true, name: true, password: true } });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const emailChanging = email !== undefined && email !== dbUser.email;

    if (!name && !emailChanging && !newPassword)
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    if (emailChanging) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== actor.id)
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });

      // Not already validated above unless a password change was also
      // requested in the same request — check it here for the email-only case.
      if (!settingNewPassword) {
        const pwParsed = currentPasswordSchema.safeParse(body);
        if (!pwParsed.success) {
          return NextResponse.json({ error: pwParsed.error.issues[0].message }, { status: 400 });
        }
        currentPassword = pwParsed.data.currentPassword;
      }
    }

    let hashedPassword: string | undefined;
    if (emailChanging || newPassword) {
      const match = currentPassword && await bcrypt.compare(currentPassword, dbUser.password);
      if (!match)
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      if (newPassword) hashedPassword = await bcrypt.hash(newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: actor.id },
      data: {
        ...(name && { name }),
        ...(hashedPassword && { password: hashedPassword }),
        // A new password invalidates the current session token, same as a
        // password reset does.
        ...(hashedPassword && { tokenVersion: { increment: 1 } }),
      },
      select: { id: true, name: true, email: true, role: true, verified: true },
    });

    // The email itself doesn't change yet: the new address has to confirm
    // via an emailed link first (POST /api/auth/confirm-email-change), and
    // the current address is told about the request. Otherwise anyone
    // holding a session and the password could quietly move the account to
    // an inbox they control, and own it from then on via forgot-password.
    if (emailChanging && email) {
      const { raw, hash } = generateToken();
      await prisma.$transaction([
        // Only the latest request's link works.
        prisma.emailChangeToken.deleteMany({ where: { userId: actor.id, usedAt: null } }),
        prisma.emailChangeToken.create({
          data: { userId: actor.id, newEmail: email, tokenHash: hash, expiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_MS) },
        }),
      ]);

      const confirmUrl = `${req.nextUrl.origin}/confirm-email-change?token=${raw}`;
      const [sentNew, sentOld] = await Promise.all([
        sendEmail({
          to: email,
          subject: "Confirm your new MaVeFaCo email address",
          html: emailHtml`
            <p>Hi ${updated.name},</p>
            <p>Click the link below to make this address the email for your MaVeFaCo account. This link expires in 24 hours.</p>
            <p><a href="${confirmUrl}">${confirmUrl}</a></p>
            <p>If you didn't ask for this, ignore this email — nothing will change.</p>
          `,
        }),
        sendEmail({
          to: dbUser.email,
          subject: "Email change requested on your MaVeFaCo account",
          html: emailHtml`
            <p>Hi ${dbUser.name},</p>
            <p>Someone signed in to your MaVeFaCo account asked to change its email address to ${email}. It won't change unless that address confirms the request.</p>
            <p>If this wasn't you, change your password now so no one else can use your account.</p>
          `,
        }),
      ]);
      if (!sentNew) console.error(`Failed to send email-change confirmation for user ${actor.id}`);
      if (!sentOld) console.error(`Failed to send email-change notice to the current address of user ${actor.id}`);

      return NextResponse.json({ ...updated, emailChangePending: email });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}

/**
 * DELETE /api/users/me — self-service account deletion.
 * Customers/farmers only: admins and managers are console-managed so no one
 * can accidentally delete their own platform-administration access. Reuses
 * the same cascade/blocking logic as the admin-initiated delete.
 */
export async function DELETE(req: NextRequest) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (actor.role !== ROLES.CUSTOMER && actor.role !== ROLES.FARMER) {
      return NextResponse.json(
        { error: "Admin and manager accounts must be removed by another admin." },
        { status: 403 },
      );
    }

    const ip = getClientIp(req);
    const { allowed, retryAfterSeconds } = rateLimit(`delete-account:${actor.id}:${ip}`, 5, 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }

    const parsed = currentPasswordSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: actor.id }, select: { password: true } });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const match = await bcrypt.compare(parsed.data.currentPassword, dbUser.password);
    if (!match) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const result = await deleteUserAccount(actor.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const response = NextResponse.json({ message: "Account deleted" });
    response.cookies.delete("token");
    return response;
  } catch (error) {
    console.error("DELETE /api/users/me error:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
