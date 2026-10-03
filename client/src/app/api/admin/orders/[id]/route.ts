import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

const VALID_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

// Managers follow a forward-only state machine; admins have full override
const MANAGER_TRANSITIONS: Record<string, string[]> = {
  pending:   ["confirmed", "cancelled"],
  confirmed: ["shipped",   "cancelled"],
  shipped:   ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

class OrderUpdateError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getActiveAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(user, [ROLES.ADMIN, ROLES.MANAGER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await context.params;
    const orderId = Number(id);
    if (isNaN(orderId))
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });

    const body = await req.json();
    const { status } = body;

    if (!VALID_STATUSES.includes(status))
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });

    const existing = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (user.role === ROLES.MANAGER) {
      const allowed = MANAGER_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(status))
        return NextResponse.json(
          { error: `Cannot move order from "${existing.status}" to "${status}"` },
          { status: 400 },
        );
    }

    const order = await prisma.$transaction(async (tx) => {
      // Conditional on the status we validated against, so a concurrent
      // update can't make the stock adjustment below apply twice.
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: existing.status },
        data: { status },
      });
      if (count === 0) throw new OrderUpdateError("Order status changed, please refresh", 409);

      const cancelling = status === "cancelled" && existing.status !== "cancelled";
      // Only an admin can get here (managers can't leave "cancelled").
      const reopening = existing.status === "cancelled" && status !== "cancelled";

      if (cancelling || reopening) {
        const items = await tx.orderItem.findMany({ where: { orderId }, include: { product: true } });
        for (const item of items) {
          if (cancelling) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          } else {
            // Reopening takes the stock back out, same guard as checkout.
            const { count } = await tx.product.updateMany({
              where: { id: item.productId, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity } },
            });
            if (count === 0)
              throw new OrderUpdateError(`Not enough stock of "${item.product.name}" to reopen this order`, 400);
          }
        }
      }

      await tx.auditLog.create({
        data: {
          action: cancelling ? "CANCEL_ORDER" : "UPDATE_ORDER_STATUS",
          entityType: "ORDER",
          entityId: orderId,
          userId: user.id,
        },
      });

      return tx.order.findUniqueOrThrow({ where: { id: orderId } });
    });

    return NextResponse.json({ ...order, totalAmount: Number(order.totalAmount) });
  } catch (err) {
    if (err instanceof OrderUpdateError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
