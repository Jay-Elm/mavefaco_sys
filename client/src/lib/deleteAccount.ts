import { prisma } from "@/lib/prisma";

const ACTIVE_STATUSES = ["pending", "confirmed", "shipped"];

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

/**
 * Shared cascade-delete logic for both self-service (DELETE /api/users/me)
 * and admin-initiated (DELETE /api/admin/users/[id]) account deletion.
 * Blocks deletion while there's an active order on either side (as a
 * customer, or as a farmer whose products are in one); otherwise clears
 * every row across the schema that has a foreign key pointing at this user
 * or their products — order matters here (dependents before the row they
 * depend on) or Postgres rejects the delete with a constraint violation.
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

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { idImagePath: true } });
  const ownProducts = await prisma.product.findMany({ where: { farmerId: userId }, select: { id: true } });
  const ownProductIds = ownProducts.map((p) => p.id);

  await prisma.$transaction([
    // Order items reference both an order and a product — clear them
    // whichever side (buyer or seller) this account was on.
    prisma.orderItem.deleteMany({ where: { order: { customerId: userId } } }),
    prisma.orderItem.deleteMany({ where: { product: { farmerId: userId } } }),
    prisma.order.deleteMany({ where: { customerId: userId } }),
    // Reviews reference a product too — both this account's own reviews
    // and anyone else's reviews left on products this account is deleting.
    prisma.review.deleteMany({ where: { productId: { in: ownProductIds } } }),
    prisma.review.deleteMany({ where: { customerId: userId } }),
    prisma.cropLog.deleteMany({ where: { product: { farmerId: userId } } }),
    prisma.product.deleteMany({ where: { farmerId: userId } }),
    prisma.message.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } }),
    prisma.announcement.deleteMany({ where: { authorId: userId } }),
    prisma.auditLog.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.emailVerificationToken.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  if (target?.idImagePath) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      fetch(`${supabaseUrl}/storage/v1/object/id-verification`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [target.idImagePath] }),
      }).catch((err) => console.error("id-image: failed to delete on account removal", err));
    }
  }

  return { ok: true };
}
