import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { DELETE as deleteCategory } from "@/app/api/categories/[id]/route";
import { GET as advisory } from "@/app/api/farmer/advisory/route";
import { POST as upload } from "@/app/api/upload/route";
import { prisma } from "@/lib/prisma";
import { createProduct, createUser, params, request, sessionToken, type SessionUser } from "@/test-utils/integration/helpers";
import { fakeStorage } from "@/test-utils/integration/storage";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

type Report = {
  summary: { totalProducts: number; approvedProducts: number };
  salesByMonth: { month: string; orders: number; revenue: number }[];
  topProducts: { name: string; unitsSold: number; revenue: number }[];
  salesByCategory: { unitsSold: number }[];
  farmerPerformance: { id: number; unitsSold: number; productCount: number }[];
};
const report = async (as: SessionUser) => (await (await GET(request("/api/admin/reports", { as }))).json()) as Report;

async function order(customerId: number, productId: number, quantity: number, status: string, createdAt?: Date) {
  return prisma.order.create({
    data: { customerId, totalAmount: 10 * quantity, status, ...(createdAt && { createdAt }), items: { create: [{ productId, quantity, price: 10 }] } },
  });
}

describe("GET /api/admin/reports accuracy (L7)", () => {
  it("counts units sold from delivered orders only, like revenue", async () => {
    const admin = await createUser({ role: "admin" });
    const farmer = await createUser({ role: "farmer" });
    const customer = await createUser();
    const product = await createProduct(farmer.id, { name: "Pechay" });
    await order(customer.id, product.id, 3, "delivered");
    await order(customer.id, product.id, 5, "pending");
    await order(customer.id, product.id, 7, "cancelled");

    const r = await report(admin);

    expect(r.topProducts).toEqual([expect.objectContaining({ name: "Pechay", unitsSold: 3, revenue: 30 })]);
    expect(r.salesByCategory[0].unitsSold).toBe(3);
    expect(r.farmerPerformance.find((f) => f.id === farmer.id)!.unitsSold).toBe(3);
  });

  it("buckets orders by Philippine month, not UTC month", async () => {
    const admin = await createUser({ role: "admin" });
    const farmer = await createUser({ role: "farmer" });
    const product = await createProduct(farmer.id);
    // 2026-10-01 07:00 in Manila = 2026-09-30 23:00 UTC.
    await order((await createUser()).id, product.id, 1, "delivered", new Date("2026-09-30T23:00:00Z"));

    expect((await report(admin)).salesByMonth.map((m) => m.month)).toEqual(["2026-10"]);
  });

  it("leaves archived products out of product counts", async () => {
    const admin = await createUser({ role: "admin" });
    const farmer = await createUser({ role: "farmer" });
    await createProduct(farmer.id);
    const archived = await createProduct(farmer.id);
    await prisma.product.update({ where: { id: archived.id }, data: { archivedAt: new Date() } });

    const r = await report(admin);

    expect(r.summary).toMatchObject({ totalProducts: 1, approvedProducts: 1 });
    expect(r.farmerPerformance.find((f) => f.id === farmer.id)!.productCount).toBe(1);
  });
});

describe("category deletion message (L9)", () => {
  it("explains when only archived products still use a category", async () => {
    const manager = await createUser({ role: "manager" });
    const product = await createProduct((await createUser({ role: "farmer" })).id);
    await prisma.product.update({ where: { id: product.id }, data: { archivedAt: new Date() } });

    const res = await deleteCategory(
      request(`/api/categories/${product.categoryId}`, { method: "DELETE", as: manager }),
      params({ id: String(product.categoryId) }),
    );

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Cannot delete: 1 archived product(s) kept for past orders still use this category");
  });
});

describe("farmer advisory (L10)", () => {
  it("only shares crop logs from approved products", async () => {
    const farmer = await createUser({ role: "farmer" });
    const approved = await createProduct(farmer.id, { name: "Approved eggplant" });
    const pending = await createProduct(farmer.id, { name: "Secret new variety", approved: false });
    for (const p of [approved, pending]) {
      await prisma.cropLog.create({ data: { productId: p.id, type: "pest_disease", note: "Fruit borer" } });
    }

    const logs = await (await advisory(request("/api/farmer/advisory", { as: await createUser({ role: "farmer" }) }))).json();

    expect(logs.map((l: { product: { name: string } }) => l.product.name)).toEqual(["Approved eggplant"]);
  });
});

describe("POST /api/upload (L5)", () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const send = (as: SessionUser) => {
    const form = new FormData();
    form.append("file", new File([PNG], "photo.png", { type: "image/png" }));
    return upload(new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      headers: { cookie: `token=${sessionToken(as)}` },
      body: form,
    }));
  };

  it("accepts product photos from farmers", async () => {
    fakeStorage();
    expect((await send(await createUser({ role: "farmer" }))).status).toBe(200);
  });

  it("refuses customers, so the public bucket isn't free image hosting", async () => {
    const calls = fakeStorage();
    expect((await send(await createUser())).status).toBe(403);
    expect(calls).toEqual([]);
  });
});
