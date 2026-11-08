import { describe, expect, it } from "vitest";
import { PATCH as farmerStatus } from "@/app/api/farmer/orders/[id]/route";
import { POST as farmerPayment } from "@/app/api/farmer/orders/[id]/payment/route";
import { PATCH as staffStatus } from "@/app/api/admin/orders/[id]/route";
import { GET as customerOrders } from "@/app/api/customer/orders/route";
import { POST as markSeen } from "@/app/api/customer/orders/seen/route";
import { GET as badges } from "@/app/api/nav-badges/route";
import { GET as thread } from "@/app/api/messages/[userId]/route";
import { prisma } from "@/lib/prisma";
import { createUser, params, request, type SessionUser } from "@/test-utils/integration/helpers";
import { placedOrder } from "@/test-utils/integration/orders";

const setStatus = (as: SessionUser, orderId: number, body: Record<string, unknown>) =>
  farmerStatus(request(`/api/farmer/orders/${orderId}`, { method: "PATCH", as, body }), params({ id: String(orderId) }));
const updates = (customerId: number) =>
  prisma.message.findMany({ where: { receiverId: customerId, kind: "order_update" }, orderBy: { id: "asc" } });
const customerBadges = async (customer: SessionUser) => (await badges(request("/api/nav-badges", { as: customer }))).json();

describe("automatic order update messages", () => {
  it("the farmer's change reaches the customer as a message, with the note", async () => {
    const { farmer, customer, order } = await placedOrder();

    expect((await setStatus(farmer, order.id, { status: "confirmed", note: "  Ready after 3 pm.  " })).status).toBe(200);

    const [msg] = await updates(customer.id);
    expect(msg).toMatchObject({ senderId: farmer.id, orderId: order.id, read: false });
    expect(msg.content).toBe(`Order #${order.id} was accepted. The farmer is getting it ready.\nNote from the farmer: Ready after 3 pm.`);

    // It shows in their chat with the farmer.
    const chat = await (await thread(request(`/api/messages/${farmer.id}`, { as: customer }), params({ userId: String(farmer.id) }))).json();
    expect(chat.at(-1)).toMatchObject({ kind: "order_update", orderId: order.id });
  });

  it("says pickup or delivery, and names the cooperative when staff act", async () => {
    const { farmer, customer, order } = await placedOrder({ status: "confirmed" });
    await setStatus(farmer, order.id, { status: "shipped" });
    expect((await updates(customer.id))[0].content).toBe(`Order #${order.id} is ready for pickup.`);

    const gcash = await placedOrder({ paymentMethod: "gcash", paymentStatus: "submitted" });
    const manager = await createUser({ role: "manager" });
    const res = await staffStatus(
      request(`/api/admin/orders/${gcash.order.id}`, { method: "PATCH", as: manager, body: { status: "cancelled" } }),
      params({ id: String(gcash.order.id) }),
    );
    expect(res.status).toBe(200);
    const [msg] = await updates(gcash.customer.id);
    // Sent in the chat with the order's farmer.
    expect(msg.senderId).toBe(gcash.farmer.id);
    expect(msg.content).toBe(`Order #${gcash.order.id} was cancelled by the cooperative. Your GCash payment will be sent back to you.`);
  });

  it("payment answers are sent too", async () => {
    const { farmer, customer, order } = await placedOrder({ paymentMethod: "gcash", paymentStatus: "submitted" });
    const res = await farmerPayment(
      request(`/api/farmer/orders/${order.id}/payment`, { method: "POST", as: farmer, body: { action: "confirm" } }),
      params({ id: String(order.id) }),
    );
    expect(res.status).toBe(200);
    expect((await updates(customer.id))[0].content).toBe(`Your GCash payment for order #${order.id} was received.`);
  });

  it("a refused change sends nothing; a note over 300 characters is refused", async () => {
    const { farmer, customer, order } = await placedOrder();
    expect((await setStatus(farmer, order.id, { status: "delivered" })).status).toBe(400);
    expect((await setStatus(farmer, order.id, { status: "confirmed", note: "x".repeat(301) })).status).toBe(400);
    expect(await updates(customer.id)).toHaveLength(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("pending");
  });
});

describe("customer badges", () => {
  it("count updated orders and unread messages until seen", async () => {
    const { farmer, customer, order } = await placedOrder();
    expect(await customerBadges(customer)).toEqual({ "/customer/orders": 0, "/customer/messages": 0 });

    await setStatus(farmer, order.id, { status: "confirmed" });
    expect(await customerBadges(customer)).toEqual({ "/customer/orders": 1, "/customer/messages": 1 });

    const list = await (await customerOrders(request("/api/customer/orders", { as: customer }))).json();
    expect(list[0]).toMatchObject({ id: order.id, updated: true });

    // Opening My Orders clears the orders badge; reading the chat clears the other.
    expect(await (await markSeen(request("/api/customer/orders/seen", { method: "POST", as: customer }))).json()).toEqual({ seen: 1 });
    expect(await (await markSeen(request("/api/customer/orders/seen", { method: "POST", as: customer }))).json()).toEqual({ seen: 0 });
    await thread(request(`/api/messages/${farmer.id}`, { as: customer }), params({ userId: String(farmer.id) }));
    expect(await customerBadges(customer)).toEqual({ "/customer/orders": 0, "/customer/messages": 0 });
    const again = await (await customerOrders(request("/api/customer/orders", { as: customer }))).json();
    expect(again[0].updated).toBe(false);
  });

  it("marking seen is for customers only", async () => {
    const farmer = await createUser({ role: "farmer" });
    expect((await markSeen(request("/api/customer/orders/seen", { method: "POST", as: farmer }))).status).toBe(403);
    expect((await markSeen(request("/api/customer/orders/seen", { method: "POST" }))).status).toBe(401);
  });
});
