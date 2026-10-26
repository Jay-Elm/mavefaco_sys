import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../generated/prisma";

const ACTIVE_ORDER_STATUSES = ["pending", "confirmed", "shipped"];

export type RemovalResult = "deleted" | "archived" | "active-orders" | "not-found";

/** Thrown inside the transaction to roll it back when the listing changed under us. */
class ListingChanged extends Error {}

/**
 * Removes a live (non-archived) listing: deletes it outright, or archives it
 * when past orders or reviews still point at it, so that history stays
 * intact. Plantings linked to it just lose the link. Refuses while an order for it is still in progress. Any open
 * notice about the listing (a suspension) is marked resolved as "removed".
 *
 * `condition` narrows which listing qualifies (e.g. "still suspended") and is
 * re-checked by the write itself, so a listing that changed in between — a
 * farmer resubmitting it, say — is left alone and reported as "not-found".
 * The caller records the audit entry.
 */
export async function removeListing(productId: number, condition: Prisma.ProductWhereInput = {}): Promise<RemovalResult> {
  const where: Prisma.ProductWhereInput = { id: productId, archivedAt: null, ...condition };

  const product = await prisma.product.findFirst({
    where,
    include: { _count: { select: { orderItems: true, reviews: true } } },
  });
  if (!product) return "not-found";

  const activeOrderItem = await prisma.orderItem.findFirst({
    where: { productId, order: { status: { in: ACTIVE_ORDER_STATUSES } } },
  });
  if (activeOrderItem) return "active-orders";

  const { orderItems, reviews } = product._count;
  const archive = orderItems + reviews > 0;
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      // Resolve first: a deleted listing's notices lose their productId.
      await tx.notice.updateMany({
        where: { productId, resolvedAt: null },
        data: { resolvedAt: now, resolution: "removed" },
      });
      const { count } = archive
        ? await tx.product.updateMany({ where, data: { archivedAt: now } })
        : await tx.product.deleteMany({ where });
      if (count === 0) throw new ListingChanged();
    });
  } catch (error) {
    if (error instanceof ListingChanged) return "not-found";
    throw error;
  }
  return archive ? "archived" : "deleted";
}
