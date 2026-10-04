import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { deleteIdImage } from "@/lib/idImageStorage";

const ACTIVE_STATUSES = ["pending", "confirmed", "shipped"];

export const DELETED_USER_NAME = "Deleted user";

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

/**
 * Shared account-deletion logic for both self-service (DELETE /api/users/me)
 * and admin-initiated (DELETE /api/admin/users/[id]) deletion.
 *
 * Deletion anonymizes rather than removes the User row. Other people's
 * records point at it — a customer's order for a farmer's product, the
 * audit log of what a staff member did — and deleting the row used to
 * mean deleting those records with it. Instead:
 *   - personal data goes: name, email, password, MFA, ID image, the
 *     user's own reviews and messages, outstanding tokens and backup codes
 *   - shared history stays: orders and order items (on both the buyer's
 *     and the seller's side), audit-log entries, announcements
 *   - a farmer's products are archived, so they leave the shop but past
 *     orders still show what was bought
 * The row keeps its role for context in history and is marked with
 * `deletedAt`; every user-facing list skips such rows.
 *
 * Still blocked while there's an active order on either side.
 */
export async function deleteUserAccount(userId: number): Promise<DeleteAccountResult> {
  const activeOrderCount = await prisma.order.count({
    where: { customerId: userId, status: { in: ACTIVE_STATUSES } },
  });
  if (activeOrderCount > 0) {
    return {
      ok: false,
      status: 409,
      error: `Cannot delete: ${activeOrderCount} active order(s) exist. Wait for them to complete or cancel, then try again.`,
    };
  }

  const productInActiveOrders = await prisma.orderItem.findFirst({
    where: { product: { farmerId: userId }, order: { status: { in: ACTIVE_STATUSES } } },
  });
  if (productInActiveOrders) {
    return {
      ok: false,
      status: 409,
      error: "Cannot delete: products are in active orders. Wait for them to complete, then try again.",
    };
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { idImagePath: true, deletedAt: true } });
  if (!target || target.deletedAt) return { ok: false, status: 404, error: "User not found" };

  // Remove the stored government ID first: once the row is scrubbed nothing
  // would reference the file, so a failed delete would leave it in storage
  // for good.
  if (target.idImagePath && !(await deleteIdImage(target.idImagePath))) {
    return {
      ok: false,
      status: 502,
      error: "Couldn't remove the stored ID image. Please try again in a moment.",
    };
  }

  // A real bcrypt hash of a secret nobody holds: login can never match it,
  // and it stays a well-formed hash for any code that compares against it.
  const unusablePassword = await bcrypt.hash(randomBytes(32).toString("hex"), 4);
  const now = new Date();

  await prisma.$transaction([
    prisma.review.deleteMany({ where: { customerId: userId } }),
    prisma.message.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } }),
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.emailVerificationToken.deleteMany({ where: { userId } }),
    prisma.totpBackupCode.deleteMany({ where: { userId } }),
    prisma.product.updateMany({ where: { farmerId: userId, archivedAt: null }, data: { archivedAt: now } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: now,
        name: DELETED_USER_NAME,
        // Frees the real address for a future sign-up; the .invalid TLD can
        // never receive mail.
        email: `deleted-user-${userId}@deleted.invalid`,
        password: unusablePassword,
        suspended: true,
        tokenVersion: { increment: 1 },
        idImagePath: null,
        verified: false,
        verifiedAt: null,
        emailVerifiedAt: null,
        totpEnabled: false,
        totpSecret: null,
        totpLastStep: null,
      },
    }),
  ]);

  return { ok: true };
}
