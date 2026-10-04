import { describe, expect, it } from "vitest";
import { deleteUserAccount, DELETED_USER_NAME } from "./deleteAccount";
import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { DELETE as adminDelete, PATCH as adminPatch } from "@/app/api/admin/users/[id]/route";
import { GET as adminUsers } from "@/app/api/admin/users/route";
import { GET as adminStats } from "@/app/api/admin/stats/route";
import { GET as farmerStats } from "@/app/api/admin/farmer-stats/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as sendMessage } from "@/app/api/messages/[userId]/route";
import { GET as listProducts } from "@/app/api/products/route";
import { createProduct, createUser, freshIp, params, request, sessionToken } from "@/test-utils/integration/helpers";
import { placedOrder } from "@/test-utils/integration/orders";

const PASSWORD = "correct-horse-battery";

describe("deleting an account anonymizes it instead of removing history", () => {
  it("keeps a deleted customer's orders, scrubbing everything that identifies them", async () => {
    const { customer, order, product } = await placedOrder({ status: "delivered" });
    const email = customer.email;
    await prisma.review.create({ data: { customerId: customer.id, productId: product.id, rating: 4, comment: "Lovely" } });
    const farmer = await prisma.user.findFirstOrThrow({ where: { role: "farmer" } });
    await prisma.message.create({ data: { senderId: customer.id, receiverId: farmer.id, content: "Hi" } });

    expect(await deleteUserAccount(customer.id)).toEqual({ ok: true });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(after).toMatchObject({
      name: DELETED_USER_NAME,
      email: `deleted-user-${customer.id}@deleted.invalid`,
      suspended: true,
      emailVerifiedAt: null,
      deletedAt: expect.any(Date),
    });
    expect(after.password).not.toBe(customer.password);
    // Their order — and so the farmer's sales record — survives intact.
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } }))
      .toMatchObject({ customerId: customer.id, items: [{ productId: product.id }] });
    // Their own content is gone.
    expect(await prisma.review.count()).toBe(0);
    expect(await prisma.message.count()).toBe(0);
    // The real email address is free to sign up again.
    expect(await prisma.user.count({ where: { email } })).toBe(0);
  });

  it("keeps other customers' orders for a deleted farmer's products (M2) and archives the products", async () => {
    const { farmer, customer, order, product } = await placedOrder({ status: "delivered" });
    await prisma.review.create({ data: { customerId: customer.id, productId: product.id, rating: 5 } });
    const unsold = await createProduct(farmer.id);

    expect(await deleteUserAccount(farmer.id)).toEqual({ ok: true });

    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    expect(items.map((i) => i.productId)).toEqual([product.id]);
    expect(await prisma.review.count({ where: { customerId: customer.id } })).toBe(1); // the customer's review stays
    for (const id of [product.id, unsold.id]) {
      expect((await prisma.product.findUniqueOrThrow({ where: { id } })).archivedAt).not.toBeNull();
    }
    expect(await (await listProducts(request("/api/products"))).json()).toEqual([]);
  });

  it("keeps the audit trail and announcements of a deleted staff member (M3)", async () => {
    const admin = await createUser({ role: "admin" });
    const manager = await createUser({ role: "manager" });
    await prisma.auditLog.create({ data: { action: "APPROVE_PRODUCT", entityType: "PRODUCT", entityId: 1, userId: manager.id } });
    await prisma.announcement.create({ data: { title: "Market day", body: "Saturday", authorId: manager.id } });

    const res = await adminDelete(request(`/api/admin/users/${manager.id}`, { method: "DELETE", as: admin }), params({ id: String(manager.id) }));

    expect(res.status).toBe(200);
    expect(await prisma.auditLog.count({ where: { userId: manager.id, action: "APPROVE_PRODUCT" } })).toBe(1);
    expect(await prisma.announcement.findFirstOrThrow({ include: { author: true } }))
      .toMatchObject({ title: "Market day", author: { name: DELETED_USER_NAME } });
  });

  it("ends every session and makes login impossible", async () => {
    const customer = await createUser({ password: PASSWORD });
    const token = sessionToken(customer);

    await deleteUserAccount(customer.id);

    expect(await getActiveAuthUser(request("/api/users/me", { cookies: { token } }))).toBeNull();
    const res = await login(request("/api/auth/login", { method: "POST", headers: freshIp(), body: { email: customer.email, password: PASSWORD } }));
    expect(res.status).toBe(401);
  });

  it("removes the account from every staff and user-facing list", async () => {
    const admin = await createUser({ role: "admin" });
    const farmer = await createUser({ role: "farmer" });
    const customer = await createUser();
    await deleteUserAccount(farmer.id);

    const users: { id: number }[] = await (await adminUsers(request("/api/admin/users", { as: admin }))).json();
    expect(users.map((u) => u.id).sort()).toEqual([admin.id, customer.id].sort());
    expect((await (await adminStats(request("/api/admin/stats", { as: admin }))).json()).userCount).toBe(2);
    expect(await (await farmerStats(request("/api/admin/farmer-stats", { as: admin }))).json()).toEqual([]);

    const message = await sendMessage(
      request(`/api/messages/${farmer.id}`, { method: "POST", as: customer, body: { content: "Hello?" } }),
      params({ userId: String(farmer.id) }),
    );
    expect(message.status).toBe(404);
  });

  it("treats an already-deleted account as not found", async () => {
    const admin = await createUser({ role: "admin" });
    const customer = await createUser();
    await deleteUserAccount(customer.id);

    expect(await deleteUserAccount(customer.id)).toMatchObject({ ok: false, status: 404 });
    const del = await adminDelete(request(`/api/admin/users/${customer.id}`, { method: "DELETE", as: admin }), params({ id: String(customer.id) }));
    expect(del.status).toBe(404);
    const patch = await adminPatch(
      request(`/api/admin/users/${customer.id}`, { method: "PATCH", as: admin, body: { suspended: false } }),
      params({ id: String(customer.id) }),
    );
    expect(patch.status).toBe(404);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).suspended).toBe(true);
  });

  it("is still blocked while the account has active orders", async () => {
    const { farmer, customer } = await placedOrder({ status: "confirmed" });

    expect(await deleteUserAccount(customer.id)).toMatchObject({ ok: false, status: 409 });
    expect(await deleteUserAccount(farmer.id)).toMatchObject({ ok: false, status: 409 });
    expect(await prisma.user.count({ where: { deletedAt: { not: null } } })).toBe(0);
  });
});
