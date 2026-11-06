import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { farmerPaymentActionSchema } from "@/validators/payment";

/**
 * POST /api/farmer/orders/[id]/payment — the farmer's answer about a GCash
 * payment, after checking their own GCash app:
 *   confirm   the money arrived (submitted → confirmed)
 *   reject    no such payment arrived (submitted → rejected, so the customer
 *             can enter it again; or, on a cancelled order whose payment was
 *             never confirmed, refund_due → rejected: nothing to return)
 *   refunded  the money was sent back (refund_due → refunded)
 */
const MOVES = {
  confirm: { from: ["submitted"], to: "confirmed", audit: "CONFIRM_PAYMENT" },
  reject: { from: ["submitted", "refund_due"], to: "rejected", audit: "REJECT_PAYMENT" },
  refunded: { from: ["refund_due"], to: "refunded", audit: "REFUND_PAYMENT" },
} as const;

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getActiveAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!authorize(user, [ROLES.FARMER])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orderId = Number((await context.params).id);
  if (!Number.isInteger(orderId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = farmerPaymentActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const action = parsed.data.action;
  const move = MOVES[action];

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { product: { select: { farmerId: true } } } } },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!order.items.some((i) => i.product.farmerId === user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (order.paymentMethod !== "gcash")
    return NextResponse.json({ error: "This order is not paid by GCash" }, { status: 400 });
  if (!(move.from as readonly string[]).includes(order.paymentStatus))
    return NextResponse.json({ error: "The payment changed, please refresh" }, { status: 409 });
  // Confirming a payment on a cancelled order would hide the refund owed.
  if (action === "confirm" && order.status === "cancelled")
    return NextResponse.json({ error: "This order was cancelled; send the money back instead" }, { status: 400 });
  // Money the farmer already confirmed can't be denied later.
  if (action === "reject" && order.paymentStatus === "refund_due" && order.paidAt)
    return NextResponse.json({ error: "You confirmed this payment earlier, so it has to be refunded" }, { status: 400 });

  const { count } = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: order.paymentStatus, status: order.status },
    data: {
      paymentStatus: move.to,
      ...(move.to === "confirmed" && { paidAt: new Date() }),
      // A rejected reference is freed so the customer can enter the right one.
      ...(move.to === "rejected" && { gcashReference: null }),
    },
  });
  if (count === 0) return NextResponse.json({ error: "The order changed, please refresh" }, { status: 409 });

  await prisma.auditLog.create({ data: { action: move.audit, entityType: "ORDER", entityId: orderId, userId: user.id } });
  return NextResponse.json({ id: orderId, paymentStatus: move.to });
}
