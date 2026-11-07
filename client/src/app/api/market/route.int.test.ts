import { describe, expect, it } from "vitest";
import { GET } from "./route";
import { PATCH as editProduct } from "../products/[id]/route";
import { POST as createProduct } from "../products/route";
import { POST as createPlantingRoute } from "../farmer/plantings/route";
import { prisma } from "@/lib/prisma";
import { createCropType, createPlanting, createProduct as makeProduct, createUser, params, request, type SessionUser } from "@/test-utils/integration/helpers";

const market = async (as: SessionUser) => GET(request("/api/market", { as }));

/** An order of `kg` kilos of the product, `daysAgo` days ago. */
async function order(customerId: number, productId: number, kg: number, { daysAgo = 3, status = "delivered", price = 80 } = {}) {
  return prisma.order.create({
    data: {
      customerId,
      totalAmount: kg * price,
      status,
      createdAt: new Date(Date.now() - daysAgo * 86_400_000),
      items: { create: [{ productId, quantity: kg, price }] },
    },
  });
}

describe("GET /api/market", () => {
  it("is for staff and farmers, not customers", async () => {
    expect((await market(await createUser())).status).toBe(403);
    for (const role of ["farmer", "manager", "admin"] as const) expect((await market(await createUser({ role }))).status).toBe(200);
  });

  it("counts sales of linked listings as demand and planted harvests as supply", async () => {
    const okra = await createCropType({ name: "Okra", daysToHarvestMin: 60, daysToHarvestMax: 75 });
    const farmer = await createUser({ role: "farmer" });
    const customer = await createUser();
    const product = await makeProduct(farmer.id, { name: "Okra" });
    await prisma.product.update({ where: { id: product.id }, data: { unit: "kg", cropTypeId: okra.id } });

    await order(customer.id, product.id, 30, { daysAgo: 5 });
    await order(customer.id, product.id, 10, { daysAgo: 10, price: 60 });
    await order(customer.id, product.id, 99, { status: "cancelled" }); // left out
    await order(customer.id, product.id, 99, { daysAgo: 70 }); // older than 8 weeks
    // 10 kg spread over a harvest window inside the next 8 weeks.
    const day = (o: number) => new Date(Date.now() + 8 * 3_600_000 + o * 86_400_000).toISOString().slice(0, 10);
    await createPlanting(farmer.id, { cropTypeId: okra.id, harvestStart: day(10), harvestEnd: day(19), expectedYield: 10 });

    const body = await (await market(await createUser({ role: "manager" }))).json();
    const row = body.rows.find((r: { crop: { name: string } }) => r.crop.name === "Okra");
    expect(row.demand).toEqual({ kg: 40, other: {}, orders: 2 });
    expect(row.supply.kg).toBeCloseTo(10, 1);
    expect(row.supply.farms).toBe(1);
    expect(row.signal).toBe("demand-above-supply");
    expect(row.pricePerKg).toBe(75); // (30×80 + 10×60) / 40
    expect(body.suggestions).toEqual([okra.id]);
    expect(body.alerts[0]).toMatchObject({ crop: "Okra", kind: "low-supply" });
    // Totals only: nobody named.
    expect(JSON.stringify(body)).not.toContain(farmer.name);
    expect(JSON.stringify(body)).not.toContain(customer.name);
  });
});

describe("a listing's crop", () => {
  it("is saved on create and changes without sending the listing back for review", async () => {
    const farmer = await createUser({ role: "farmer" });
    await prisma.user.update({ where: { id: farmer.id }, data: { verified: true, verifiedAt: new Date() } });
    const crop = await createCropType({ name: "Pechay" });
    const category = await prisma.category.create({ data: { name: "Leafy" } });

    const res = await createProduct(request("/api/products", {
      method: "POST", as: farmer,
      body: { name: "Pechay", description: "", price: 40, stock: 10, unit: "bundle", categoryId: category.id, cropTypeId: crop.id },
    }));
    expect(res.status).toBe(201);
    const { id } = (await res.json()).product;
    expect((await prisma.product.findUniqueOrThrow({ where: { id } })).cropTypeId).toBe(crop.id);

    await prisma.product.update({ where: { id }, data: { approved: true } });
    const other = await createCropType({ name: "Mustasa" });
    const edit = await editProduct(request(`/api/products/${id}`, { method: "PATCH", as: farmer, body: { cropTypeId: other.id } }), params({ id: String(id) }));
    expect(edit.status).toBe(200);
    expect(await prisma.product.findUniqueOrThrow({ where: { id } })).toMatchObject({ cropTypeId: other.id, approved: true });

    const clear = await editProduct(request(`/api/products/${id}`, { method: "PATCH", as: farmer, body: { cropTypeId: null } }), params({ id: String(id) }));
    expect(clear.status).toBe(200);
    expect((await prisma.product.findUniqueOrThrow({ where: { id } })).cropTypeId).toBeNull();
  });

  it("refuses a crop that doesn't exist", async () => {
    const farmer = await createUser({ role: "farmer" });
    const product = await makeProduct(farmer.id);
    const res = await editProduct(request(`/api/products/${product.id}`, { method: "PATCH", as: farmer, body: { cropTypeId: 999999 } }), params({ id: String(product.id) }));
    expect(res.status).toBe(400);
  });

  it("is filled in from a planting sold under a listing that has none", async () => {
    const farmer = await createUser({ role: "farmer" });
    const crop = await createCropType({ name: "Upo" });
    const product = await makeProduct(farmer.id, { name: "Gourd" });
    const res = await createPlantingRoute(request("/api/farmer/plantings", {
      method: "POST", as: farmer,
      body: { cropTypeId: crop.id, plantedOn: new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10), productId: product.id },
    }));
    expect(res.status).toBe(201);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).cropTypeId).toBe(crop.id);
  });
});
