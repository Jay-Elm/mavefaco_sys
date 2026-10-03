import { describe, expect, it } from "vitest";
import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { createUser, params, request, type SessionUser } from "@/test-utils/integration/helpers";
import { placedOrder } from "@/test-utils/integration/orders";

const setStatus = (as: SessionUser | undefined, orderId: number, status: string) =>
  PATCH(request(`/api/admin/orders/${orderId}`, { method: "PATCH", as, body: { status } }), params({ id: String(orderId) }));
const statusOf = async (id: number) => (await prisma.order.findUniqueOrThrow({ where: { id } })).status;

describe("PATCH /api/admin/orders/[id]", () => {
  it.each(["customer", "farmer"] as const)("forbids a %s", async (role) => {
    const { order } = await placedOrder();
    const user = await createUser({ role });

    expect((await setStatus(user, order.id, "confirmed")).status).toBe(403);
    expect(await statusOf(order.id)).toBe("pending");
  });

  describe("manager", () => {
    it("can move an order one step forward", async () => {
      const { order } = await placedOrder();
      const manager = await createUser({ role: "manager" });

      expect((await setStatus(manager, order.id, "confirmed")).status).toBe(200);
      expect(await statusOf(order.id)).toBe("confirmed");
    });

    it.each([
      ["pending", "shipped"], // skipping a step
      ["shipped", "pending"], // going backwards
      ["delivered", "cancelled"], // reopening a finished order
      ["cancelled", "pending"],
    ])("cannot move %s → %s", async (from, to) => {
      const { order } = await placedOrder({ status: from });
      const manager = await createUser({ role: "manager" });

      expect((await setStatus(manager, order.id, to)).status).toBe(400);
      expect(await statusOf(order.id)).toBe(from);
    });
  });

  it("lets an admin override the state machine", async () => {
    const { order } = await placedOrder({ status: "delivered" });
    const admin = await createUser({ role: "admin" });

    expect((await setStatus(admin, order.id, "pending")).status).toBe(200);
    expect(await statusOf(order.id)).toBe("pending");
  });

  it("restores stock when a manager cancels an order", async () => {
    const { order, stockNow } = await placedOrder({ stock: 10, quantity: 3 });
    const manager = await createUser({ role: "manager" });

    expect((await setStatus(manager, order.id, "cancelled")).status).toBe(200);
    expect(await stockNow()).toBe(10);
    expect(await prisma.auditLog.count({ where: { action: "CANCEL_ORDER", entityId: order.id } })).toBe(1);
  });

  it("does not restock when an admin re-saves an already-cancelled order", async () => {
    const { order, stockNow } = await placedOrder({ status: "cancelled", stock: 10, quantity: 3 });
    // placedOrder leaves stock deducted; a cancelled order would have had it returned.
    await prisma.product.updateMany({ data: { stock: 10 } });
    const admin = await createUser({ role: "admin" });

    expect((await setStatus(admin, order.id, "cancelled")).status).toBe(200);
    expect(await stockNow()).toBe(10);
  });

  it("takes the stock back out when an admin reopens a cancelled order", async () => {
    const { order, stockNow } = await placedOrder({ status: "cancelled", stock: 10, quantity: 3 });
    await prisma.product.updateMany({ data: { stock: 10 } });
    const admin = await createUser({ role: "admin" });

    expect((await setStatus(admin, order.id, "pending")).status).toBe(200);
    expect(await stockNow()).toBe(7);
  });

  it("refuses to reopen a cancelled order when the stock has since sold out", async () => {
    const { order, stockNow } = await placedOrder({ status: "cancelled", stock: 10, quantity: 3 });
    await prisma.product.updateMany({ data: { stock: 2 } });
    const admin = await createUser({ role: "admin" });

    const res = await setStatus(admin, order.id, "pending");

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Not enough stock/);
    expect(await statusOf(order.id)).toBe("cancelled");
    expect(await stockNow()).toBe(2);
  });
});
