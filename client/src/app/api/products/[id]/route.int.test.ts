import { describe, expect, it } from "vitest";
import { DELETE, GET, PATCH } from "./route";
import { PATCH as adminPATCH } from "@/app/api/admin/products/[id]/route";
import { GET as adminList } from "@/app/api/admin/products/route";
import { GET as list } from "@/app/api/products/route";
import { prisma } from "@/lib/prisma";
import { createProduct, createUser, params, request, type SessionUser } from "@/test-utils/integration/helpers";
import { placedOrder } from "@/test-utils/integration/orders";

const get = (id: number, as?: SessionUser) => GET(request(`/api/products/${id}`, { as }), params({ id: String(id) }));
const patch = (id: number, as: SessionUser, body: unknown) =>
  PATCH(request(`/api/products/${id}`, { method: "PATCH", as, body }), params({ id: String(id) }));
const del = (id: number, as: SessionUser) =>
  DELETE(request(`/api/products/${id}`, { method: "DELETE", as }), params({ id: String(id) }));
const approval = async (id: number) => (await prisma.product.findUniqueOrThrow({ where: { id } })).approved;

describe("GET /api/products/[id]", () => {
  it("shows an approved product to anyone", async () => {
    const product = await createProduct((await createUser({ role: "farmer" })).id);
    expect((await get(product.id)).status).toBe(200);
  });

  it("hides an unapproved product from everyone but its farmer and staff", async () => {
    const farmer = await createUser({ role: "farmer" });
    const product = await createProduct(farmer.id, { approved: false });

    expect((await get(product.id)).status).toBe(404);
    expect((await get(product.id, await createUser())).status).toBe(404);
    expect((await get(product.id, await createUser({ role: "farmer" }))).status).toBe(404);

    expect((await get(product.id, farmer)).status).toBe(200);
    expect((await get(product.id, await createUser({ role: "manager" }))).status).toBe(200);
  });
});

describe("PATCH /api/products/[id]", () => {
  it("sends an approved product back for review when its farmer changes what customers see", async () => {
    const farmer = await createUser({ role: "farmer" });
    const product = await createProduct(farmer.id, { price: 50 });

    const res = await patch(product.id, farmer, { price: 55 });

    expect(res.status).toBe(200);
    expect((await res.json()).price).toBe(55);
    expect(await approval(product.id)).toBe(false);
  });

  it.each([
    ["a stock-only change", { stock: 3 }],
    ["re-saving unchanged values", { name: "Same", price: 50 }],
  ])("keeps approval for %s", async (_, body) => {
    const farmer = await createUser({ role: "farmer" });
    const product = await createProduct(farmer.id, { name: "Same", price: 50 });

    expect((await patch(product.id, farmer, body)).status).toBe(200);
    expect(await approval(product.id)).toBe(true);
  });

  it("doesn't revoke approval when a manager edits", async () => {
    const product = await createProduct((await createUser({ role: "farmer" })).id);

    await patch(product.id, await createUser({ role: "manager" }), { name: "Renamed" });

    expect(await approval(product.id)).toBe(true);
  });

  it("forbids editing another farmer's product, and customers entirely", async () => {
    const product = await createProduct((await createUser({ role: "farmer" })).id, { name: "Original" });

    expect((await patch(product.id, await createUser({ role: "farmer" }), { name: "Hijacked" })).status).toBe(403);
    expect((await patch(product.id, await createUser(), { name: "Hijacked" })).status).toBe(403);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).name).toBe("Original");
  });
});

describe("DELETE /api/products/[id]", () => {
  it("lets a farmer delete their own product that has no history", async () => {
    const farmer = await createUser({ role: "farmer" });
    const product = await createProduct(farmer.id);

    expect((await del(product.id, farmer)).status).toBe(200);
    expect(await prisma.product.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "DELETE_PRODUCT", entityId: product.id } })).toBe(1);
  });

  it("forbids deleting another farmer's product", async () => {
    const product = await createProduct((await createUser({ role: "farmer" })).id);

    expect((await del(product.id, await createUser({ role: "farmer" }))).status).toBe(403);
    expect(await prisma.product.count()).toBe(1);
  });

  it.each(["pending", "confirmed", "shipped"])("refuses while an order is still %s", async (status) => {
    const { farmer, product } = await placedOrder({ status });

    expect((await del(product.id, farmer)).status).toBe(409);
    expect(await prisma.product.count()).toBe(1);
  });

  it.each(["delivered", "cancelled"])("archives instead of deleting once its orders are %s, keeping the history", async (status) => {
    const { farmer, order, product } = await placedOrder({ status });

    const res = await del(product.id, farmer);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ archived: true });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).archivedAt).not.toBeNull();
    expect(await prisma.orderItem.count({ where: { orderId: order.id, productId: product.id } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "ARCHIVE_PRODUCT", entityId: product.id } })).toBe(1);
  });

  it("archives a product that only has reviews or crop logs, keeping them", async () => {
    const { farmer, customer, product } = await placedOrder({ status: "delivered" });
    await prisma.orderItem.deleteMany(); // leave reviews as the only history
    await prisma.review.create({ data: { customerId: customer.id, productId: product.id, rating: 5 } });
    const crop = await createProduct(farmer.id);
    await prisma.cropLog.create({ data: { productId: crop.id, type: "note", note: "Planted" } });

    expect(await (await del(product.id, farmer)).json()).toMatchObject({ archived: true });
    expect(await (await del(crop.id, farmer)).json()).toMatchObject({ archived: true });
    expect(await prisma.review.count()).toBe(1);
    expect(await prisma.cropLog.count()).toBe(1);
  });

  it("makes an archived product disappear everywhere live, even for its farmer and staff", async () => {
    const { farmer, product } = await placedOrder({ status: "delivered" });
    const manager = await createUser({ role: "manager" });
    await del(product.id, farmer);

    expect((await get(product.id, farmer)).status).toBe(404);
    expect((await get(product.id, manager)).status).toBe(404);
    expect((await patch(product.id, farmer, { stock: 99 })).status).toBe(404);
    expect((await del(product.id, farmer)).status).toBe(404);

    expect(await (await list(request("/api/products"))).json()).toEqual([]);
    expect(await (await list(request(`/api/products?farmerId=${farmer.id}`, { as: farmer }))).json()).toEqual([]);
    expect(await (await adminList(request("/api/admin/products", { as: manager }))).json()).toEqual([]);
  });
});

describe("admin product approval", () => {
  const approve = (id: number, as: SessionUser, approved: boolean) =>
    adminPATCH(request(`/api/admin/products/${id}`, { method: "PATCH", as, body: { approved } }), params({ id: String(id) }));

  it("lets a manager approve and reject, with an audit trail", async () => {
    const manager = await createUser({ role: "manager" });
    const product = await createProduct((await createUser({ role: "farmer" })).id, { approved: false });

    expect((await approve(product.id, manager, true)).status).toBe(200);
    expect(await approval(product.id)).toBe(true);
    expect((await approve(product.id, manager, false)).status).toBe(200);
    expect(await approval(product.id)).toBe(false);

    const actions = (await prisma.auditLog.findMany({ where: { entityId: product.id }, orderBy: { id: "asc" } })).map((l) => l.action);
    expect(actions).toEqual(["APPROVE_PRODUCT", "REJECT_PRODUCT"]);
  });

  it("doesn't let a farmer approve their own product", async () => {
    const farmer = await createUser({ role: "farmer" });
    const product = await createProduct(farmer.id, { approved: false });

    expect((await approve(product.id, farmer, true)).status).toBe(403);
    expect(await approval(product.id)).toBe(false);
  });

  it("lists every product, approved or not, to staff only", async () => {
    const farmer = await createUser({ role: "farmer" });
    await createProduct(farmer.id);
    await createProduct(farmer.id, { approved: false });

    const staff = await adminList(request("/api/admin/products", { as: await createUser({ role: "admin" }) }));
    expect(await staff.json()).toHaveLength(2);
    expect((await adminList(request("/api/admin/products", { as: farmer }))).status).toBe(403);
  });
});
