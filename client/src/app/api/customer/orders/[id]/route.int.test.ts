import { describe, expect, it } from "vitest";
import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { createUser, params, request, type SessionUser } from "@/test-utils/integration/helpers";
import { placedOrder } from "@/test-utils/integration/orders";

const setStatus = (as: SessionUser | undefined, orderId: number, status: string) =>
  PATCH(request(`/api/customer/orders/${orderId}`, { method: "PATCH", as, body: { status } }), params({ id: String(orderId) }));

describe("PATCH /api/customer/orders/[id]", () => {
  it("lets the customer cancel a pending order and puts the stock back", async () => {
    const { customer, order, stockNow } = await placedOrder({ stock: 10, quantity: 3 });

    const res = await setStatus(customer, order.id, "cancelled");

    expect(res.status).toBe(200);
    expect(await stockNow()).toBe(10);
    expect(await prisma.auditLog.count({ where: { action: "CANCEL_ORDER", entityId: order.id } })).toBe(1);
  });

  it("lets the customer confirm receipt of a shipped order", async () => {
    const { customer, order, stockNow } = await placedOrder({ status: "shipped", stock: 10, quantity: 3 });

    const res = await setStatus(customer, order.id, "delivered");

    expect(res.status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("delivered");
    expect(await stockNow()).toBe(7);
  });

  it.each([
    ["confirmed", "cancelled"], // too late to cancel once the farmer confirmed
    ["pending", "delivered"],
    ["cancelled", "cancelled"], // would restock twice
    ["delivered", "cancelled"],
  ])("refuses %s → %s and leaves stock alone", async (from, to) => {
    const { customer, order, stockNow } = await placedOrder({ status: from, stock: 10, quantity: 3 });

    const res = await setStatus(customer, order.id, to);

    expect(res.status).toBe(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(from);
    expect(await stockNow()).toBe(7);
  });

  it("forbids changing another customer's order", async () => {
    const { order } = await placedOrder();
    const stranger = await createUser();

    const res = await setStatus(stranger, order.id, "cancelled");

    expect(res.status).toBe(403);
  });

  it("returns 404 for an order that doesn't exist", async () => {
    const customer = await createUser();
    expect((await setStatus(customer, 999, "cancelled")).status).toBe(404);
  });
});
