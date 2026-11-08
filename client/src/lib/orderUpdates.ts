import { z } from "zod";
import type { prisma } from "@/lib/prisma";

/** The client inside prisma.$transaction (the app's extended client). */
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Automatic "Order update" messages, like the order chats of Shopee or
 * Lazada: when the farmer or staff change an order, the customer gets a
 * message in their chat with the order's farmer (one farmer per order), and
 * My Orders shows the order as updated until they open it.
 */

export type OrderEvent =
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "reopened"
  | "payment_confirmed"
  | "payment_rejected"
  | "refunded";

/** The optional note a farmer adds for the customer when changing an order. */
export const NOTE_MAX = 300;
export const orderNoteSchema = z
  .string()
  .trim()
  .max(NOTE_MAX, `Keep the note to ${NOTE_MAX} characters`)
  .optional()
  .transform((v) => v || undefined);

export interface UpdateContext {
  orderId: number;
  deliveryMethod: string;
  /** Payment status after the change (for the refund line on a cancel). */
  paymentStatus: string;
  /** A manager or admin made the change, not the farmer. */
  byStaff: boolean;
  /** For payment_rejected on a cancelled order: nothing was paid, so nothing to refund. */
  orderCancelled?: boolean;
}

/** The message text for one change. */
export function orderUpdateText(event: OrderEvent, ctx: UpdateContext, note?: string): string {
  const n = `#${ctx.orderId}`;
  const pickup = ctx.deliveryMethod === "pickup";
  const who = ctx.byStaff ? "the cooperative" : "the farmer";
  const lines: Record<OrderEvent, string> = {
    confirmed: `Order ${n} was accepted. The farmer is getting it ready.`,
    shipped: pickup ? `Order ${n} is ready for pickup.` : `Order ${n} is on its way.`,
    delivered: pickup ? `Order ${n} was picked up. Thank you for your order!` : `Order ${n} was delivered. Thank you for your order!`,
    cancelled:
      `Order ${n} was cancelled by ${who}.` +
      (ctx.paymentStatus === "refund_due" ? " Your GCash payment will be sent back to you." : ""),
    reopened: `Order ${n} was reopened by the cooperative.`,
    payment_confirmed: `Your GCash payment for order ${n} was received.`,
    payment_rejected: ctx.orderCancelled
      ? `No GCash payment for order ${n} arrived, so there is nothing to refund.`
      : `The farmer couldn't find your GCash payment for order ${n}. Check the reference number and enter it again in My Orders.`,
    refunded: `Your GCash refund for order ${n} was sent. Check your GCash app.`,
  };
  const text = lines[event];
  return note ? `${text}\nNote from ${ctx.byStaff ? "the cooperative" : "the farmer"}: ${note}` : text;
}

/**
 * Sends the customer the update message (from the order's farmer) and marks
 * the order as updated for them. Call it inside the transaction that made
 * the change, so both happen or neither does.
 */
export async function notifyCustomer(
  tx: Tx,
  orderId: number,
  event: OrderEvent,
  { byStaff, note }: { byStaff: boolean; note?: string },
) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      customerId: true,
      status: true,
      deliveryMethod: true,
      paymentStatus: true,
      items: { take: 1, select: { product: { select: { farmerId: true } } } },
    },
  });
  const farmerId = order.items[0]?.product.farmerId;
  const content = orderUpdateText(
    event,
    { orderId, deliveryMethod: order.deliveryMethod, paymentStatus: order.paymentStatus, byStaff, orderCancelled: order.status === "cancelled" },
    note,
  );
  if (farmerId !== undefined) {
    await tx.message.create({
      data: { senderId: farmerId, receiverId: order.customerId, content, kind: "order_update", orderId },
    });
  }
  await tx.order.update({ where: { id: orderId }, data: { customerNotifiedAt: new Date() } });
}
