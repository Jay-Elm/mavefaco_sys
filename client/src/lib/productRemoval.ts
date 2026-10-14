import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../generated/prisma";

const ACTIVE_ORDER_STATUSES = ["pending", "confirmed", "shipped"];

export type RemovalResult = "deleted" | "archived" | "active-orders" | "not-found";

/**
 * Removes a live (non-archived) listing: deletes it outright, or archives it
 * when past orders, reviews or crop logs still point at it, so that history
 * stays intact. Refuses while an order for it is still in progress.
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
    include: { _count: { select: { orderItems: true, reviews: true, cropLogs: true } } },
  });
  if (!product) return "not-found";

  const activeOrderItem = await prisma.orderItem.findFirst({
    where: { productId, order: { status: { in: ACTIVE_ORDER_STATUSES } } },
  });
  if (activeOrderItem) return "active-orders";

  const { orderItems, reviews, cropLogs } = product._count;
  if (orderItems + reviews + cropLogs > 0) {
    const { count } = await prisma.product.updateMany({ where, data: { archivedAt: new Date() } });
    return count === 0 ? "not-found" : "archived";
  }
  const { count } = await prisma.product.deleteMany({ where });
  return count === 0 ? "not-found" : "deleted";
}
