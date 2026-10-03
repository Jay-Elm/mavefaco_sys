import { describe, expect, it } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { createProduct, createUser, request, type SessionUser } from "@/test-utils/integration/helpers";

const checkout = (as: SessionUser | undefined, items: { productId: number; quantity: number }[]) =>
  POST(request("/api/orders", { method: "POST", as, body: { items, paymentMethod: "cod", deliveryMethod: "pickup" } }));

describe("POST /api/orders (checkout)", () => {
  it("creates the order, snapshots prices, decrements stock and writes an audit log", async () => {
    const farmer = await createUser({ role: "farmer" });
    const customer = await createUser();
    const tomato = await createProduct(farmer.id, { price: 45.5, stock: 10 });
    const onion = await createProduct(farmer.id, { price: 30, stock: 5 });

    const res = await checkout(customer, [
      { productId: tomato.id, quantity: 2 },
      { productId: onion.id, quantity: 5 },
    ]);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.totalAmount).toBe(241); // 2 × 45.50 + 5 × 30

    const order = await prisma.order.findUniqueOrThrow({ where: { id: body.id }, include: { items: true } });
    expect(order.customerId).toBe(customer.id);
    expect(order.status).toBe("pending");
    expect(order.items.map((i) => [i.productId, i.quantity, Number(i.price)])).toEqual(
      expect.arrayContaining([[tomato.id, 2, 45.5], [onion.id, 5, 30]]),
    );

    expect((await prisma.product.findUniqueOrThrow({ where: { id: tomato.id } })).stock).toBe(8);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: onion.id } })).stock).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityType: "Order", entityId: order.id } })).toBe(1);
  });

  it("rejects the whole order and changes nothing when one item is short on stock", async () => {
    const farmer = await createUser({ role: "farmer" });
    const customer = await createUser();
    const plenty = await createProduct(farmer.id, { stock: 10 });
    const scarce = await createProduct(farmer.id, { name: "Mangoes", stock: 1 });

    const res = await checkout(customer, [
      { productId: plenty.id, quantity: 3 },
      { productId: scarce.id, quantity: 2 },
    ]);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Insufficient stock for "Mangoes"/);
    expect(await prisma.order.count()).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: plenty.id } })).stock).toBe(10);
  });

  it("never oversells when two customers race for the last unit", async () => {
    const farmer = await createUser({ role: "farmer" });
    const [alice, bob] = [await createUser(), await createUser()];
    const last = await createProduct(farmer.id, { stock: 1 });

    const results = await Promise.all([
      checkout(alice, [{ productId: last.id, quantity: 1 }]),
      checkout(bob, [{ productId: last.id, quantity: 1 }]),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(await prisma.order.count()).toBe(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: last.id } })).stock).toBe(0);
  });

  it("rejects products that aren't approved", async () => {
    const farmer = await createUser({ role: "farmer" });
    const customer = await createUser();
    const pending = await createProduct(farmer.id, { name: "Unreviewed", approved: false });

    const res = await checkout(customer, [{ productId: pending.id, quantity: 1 }]);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/"Unreviewed" is no longer available/);
  });

  it("rejects a cart mixing products from different farmers", async () => {
    const customer = await createUser();
    const a = await createProduct((await createUser({ role: "farmer" })).id);
    const b = await createProduct((await createUser({ role: "farmer" })).id);

    const res = await checkout(customer, [
      { productId: a.id, quantity: 1 },
      { productId: b.id, quantity: 1 },
    ]);

    expect(res.status).toBe(400);
    expect(await prisma.order.count()).toBe(0);
  });

  describe("authentication", () => {
    it("rejects a request with no session", async () => {
      const res = await checkout(undefined, [{ productId: 1, quantity: 1 }]);
      expect(res.status).toBe(401);
    });

    it("rejects a session revoked by a tokenVersion bump (logout / password change)", async () => {
      const customer = await createUser();
      await prisma.user.update({ where: { id: customer.id }, data: { tokenVersion: { increment: 1 } } });

      const res = await checkout(customer, [{ productId: 1, quantity: 1 }]); // token still carries version 0
      expect(res.status).toBe(401);
    });

    it("rejects a suspended account even with a valid session", async () => {
      const customer = await createUser({ suspended: true });
      const res = await checkout(customer, [{ productId: 1, quantity: 1 }]);
      expect(res.status).toBe(401);
    });
  });
});
