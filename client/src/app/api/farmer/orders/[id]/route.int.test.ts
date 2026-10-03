import { describe, expect, it } from "vitest";
import { PATCH } from "./route";
import { PATCH as customerPATCH } from "@/app/api/customer/orders/[id]/route";
import { prisma } from "@/lib/prisma";
import { createUser, params, request, withRowLocked, type SessionUser } from "@/test-utils/integration/helpers";
import { placedOrder } from "@/test-utils/integration/orders";

const setStatus = (as: SessionUser | undefined, orderId: number, status: string) =>
  PATCH(request(`/api/farmer/orders/${orderId}`, { method: "PATCH", as, body: { status } }), params({ id: String(orderId) }));

describe("PATCH /api/farmer/orders/[id]", () => {
  it("lets the farmer move their own order forward", async () => {
    const { farmer, order } = await placedOrder();

    const res = await setStatus(farmer, order.id, "confirmed");

    expect(res.status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("confirmed");
  });

  it("restores stock when the farmer cancels a pending order", async () => {
    const { farmer, order, stockNow } = await placedOrder({ stock: 10, quantity: 3 });

    await setStatus(farmer, order.id, "cancelled");

    expect(await stockNow()).toBe(10);
  });

  it("forbids a farmer from touching another farmer's order", async () => {
    const { order } = await placedOrder();
    const otherFarmer = await createUser({ role: "farmer" });

    expect((await setStatus(otherFarmer, order.id, "shipped")).status).toBe(403);
  });

  it("forbids non-farmers, including the order's own customer", async () => {
    const { customer, order } = await placedOrder();

    expect((await setStatus(customer, order.id, "confirmed")).status).toBe(403);
  });

  it("rejects an unknown status", async () => {
    const { farmer, order } = await placedOrder();

    expect((await setStatus(farmer, order.id, "teleported")).status).toBe(400);
  });

  it("does not restock a second time when an already-cancelled order is cancelled again", async () => {
    const { farmer, order, stockNow } = await placedOrder({ stock: 10, quantity: 3 });

    await setStatus(farmer, order.id, "cancelled");
    const again = await setStatus(farmer, order.id, "cancelled");

    expect(again.status).toBe(400);
    expect(await stockNow()).toBe(10);
  });

  it.each([
    ["pending", "shipped"], // skipping a step
    ["shipped", "cancelled"], // already on its way
    ["delivered", "cancelled"],
    ["delivered", "pending"],
    ["cancelled", "confirmed"],
  ])("refuses %s → %s and leaves stock alone", async (from, to) => {
    const { farmer, order, stockNow } = await placedOrder({ status: from, stock: 10, quantity: 3 });

    expect((await setStatus(farmer, order.id, to)).status).toBe(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(from);
    expect(await stockNow()).toBe(7);
  });

  it("restocks only once when the farmer and the customer cancel at the same moment", async () => {
    const { farmer, customer, order, stockNow } = await placedOrder({ stock: 10, quantity: 3 });

    // Both requests see "pending", then queue on the order row before writing.
    const results = await withRowLocked("Order", order.id, 2, () =>
      Promise.all([
        setStatus(farmer, order.id, "cancelled"),
        customerPATCH(
          request(`/api/customer/orders/${order.id}`, { method: "PATCH", as: customer, body: { status: "cancelled" } }),
          params({ id: String(order.id) }),
        ),
      ]),
    );

    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await stockNow()).toBe(10);
  });
});
