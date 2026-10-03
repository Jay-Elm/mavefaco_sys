import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

const VALID_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

// Forward-only, matching the actions the farmer Orders page offers. Without
// this, re-cancelling an order restocked it a second time.
const FARMER_TRANSITIONS: Record<string, string[]> = {
  pending:   ["confirmed", "cancelled"],
  confirmed: ["shipped",   "cancelled"],
  shipped:   ["delivered"],
  delivered: [],
  cancelled: [],
};

class StaleStatusError extends Error {}

/** PATCH /api/farmer/orders/[id] — farmer updates status on their own orders */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getActiveAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(user, [ROLES.FARMER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await context.params;
    const orderId = Number(id);
    if (isNaN(orderId))
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const belongsToFarmer = order.items.some((item) => item.product.farmerId === user.id);
    if (!belongsToFarmer)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { status } = await req.json();
    if (!VALID_STATUSES.includes(status))
      return NextResponse.json(
        { error: `Status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 },
      );

    if (!(FARMER_TRANSITIONS[order.status] ?? []).includes(status))
      return NextResponse.json(
        { error: `Cannot move order from "${order.status}" to "${status}"` },
        { status: 400 },
      );

    const updated = await prisma.$transaction(async (tx) => {
      // Conditional on the status we validated against, so two concurrent
      // requests can't both apply (and both restock).
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status },
      });
      if (count === 0) throw new StaleStatusError();

      if (status === "cancelled") {
        const items = await tx.orderItem.findMany({ where: { orderId } });
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          action: status === "cancelled" ? "CANCEL_ORDER" : "UPDATE_ORDER_STATUS",
          entityType: "ORDER",
          entityId: orderId,
          userId: user.id,
        },
      });

      return { id: orderId, status };
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof StaleStatusError)
      return NextResponse.json({ error: "Order status changed, please refresh" }, { status: 409 });
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
