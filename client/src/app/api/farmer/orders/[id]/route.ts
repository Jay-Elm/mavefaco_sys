import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/getAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

const VALID_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

/** PATCH /api/farmer/orders/[id] — farmer updates status on their own orders */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = getAuthUser(req);
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

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      select: { id: true, status: true },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_ORDER_STATUS",
        entityType: "ORDER",
        entityId: orderId,
        userId: user.id,
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
