import { describe, expect, it } from "vitest";
import { PATCH as link } from "./route";
import { PATCH as editProduct } from "@/app/api/products/[id]/route";
import { POST as createPlanting } from "@/app/api/farmer/plantings/route";
import { POST as createCropTypeRoute } from "@/app/api/crop-types/route";
import { prisma } from "@/lib/prisma";
import { createCropType, createProduct, createUser, params, request, type SessionUser } from "@/test-utils/integration/helpers";

const setCrop = (as: SessionUser, id: number, body: unknown) =>
  link(request(`/api/admin/products/${id}/crop`, { method: "PATCH", as, body }), params({ id: String(id) }));
const today = () => new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + 8 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);

describe("PATCH /api/admin/products/[id]/crop", () => {
  it("lets staff link a listing without touching its review status, and audits it", async () => {
    const farmer = await createUser({ role: "farmer" });
    const product = await createProduct(farmer.id, { name: "Talong (Batangas)", approved: false });
    const crop = await createCropType({ name: "Eggplant" });

    for (const role of ["manager", "admin"] as const) {
      const res = await setCrop(await createUser({ role }), product.id, { cropTypeId: crop.id });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ cropTypeId: crop.id, notACrop: false, cropType: { name: "Eggplant" } });
    }
    expect(await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ cropTypeId: crop.id, approved: false });
    expect(await prisma.auditLog.count({ where: { action: "LINK_PRODUCT_CROP", entityId: product.id } })).toBe(2);
  });

  it("marks a listing 'not a farm crop', which clears its crop, and back", async () => {
    const farmer = await createUser({ role: "farmer" });
    const product = await createProduct(farmer.id, { name: "Ground Coffee" });
    const manager = await createUser({ role: "manager" });
    const crop = await createCropType({ name: "Coffee" });
    await setCrop(manager, product.id, { cropTypeId: crop.id });

    await setCrop(manager, product.id, { notACrop: true });
    expect(await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ cropTypeId: null, notACrop: true });

    await setCrop(manager, product.id, { cropTypeId: crop.id });
    expect(await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ cropTypeId: crop.id, notACrop: false });
  });

  it("is for staff only, and refuses unknown crops", async () => {
    const farmer = await createUser({ role: "farmer" });
    const product = await createProduct(farmer.id);
    expect((await setCrop(farmer, product.id, { notACrop: true })).status).toBe(403);
    expect((await setCrop(await createUser({ role: "manager" }), product.id, { cropTypeId: 999999 })).status).toBe(400);
  });
});

describe("farmers and the crop link", () => {
  it("a farmer can mark their own listing 'not a farm crop' without a new review", async () => {
    const farmer = await createUser({ role: "farmer" });
    const product = await createProduct(farmer.id, { name: "Cacao Balls" });
    const res = await editProduct(request(`/api/products/${product.id}`, { method: "PATCH", as: farmer, body: { notACrop: true } }), params({ id: String(product.id) }));
    expect(res.status).toBe(200);
    expect(await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ notACrop: true, approved: true });
  });
});

describe("crops with no typical growing time", () => {
  it("staff can add one with the days left blank", async () => {
    const res = await createCropTypeRoute(request("/api/crop-types", {
      method: "POST", as: await createUser({ role: "manager" }),
      body: { name: "Kundol", category: "Fruit vegetables", daysToHarvestMin: null, daysToHarvestMax: null, aliases: "kundol, wax gourd" },
    }));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ daysToHarvestMin: null, aliases: ["kundol", "wax gourd"], category: "Fruit vegetables" });

    const half = await createCropTypeRoute(request("/api/crop-types", {
      method: "POST", as: await createUser({ role: "manager" }), body: { name: "Half", daysToHarvestMin: 30, daysToHarvestMax: null },
    }));
    expect(half.status).toBe(400);
  });

  it("a planting of one needs the farmer's expected harvest dates", async () => {
    const farmer = await createUser({ role: "farmer" });
    const kundol = await prisma.cropType.create({ data: { name: "Kundol", daysToHarvestMin: null, daysToHarvestMax: null } });
    const plant = (extra: object) =>
      createPlanting(request("/api/farmer/plantings", { method: "POST", as: farmer, body: { cropTypeId: kundol.id, plantedOn: today(), ...extra } }));

    const without = await plant({});
    expect(without.status).toBe(400);
    expect((await without.json()).error).toMatch(/no typical growing time/);

    expect((await plant({ harvestStart: plusDays(30), harvestEnd: plusDays(20) })).status).toBe(400);
    const ok = await plant({ harvestStart: plusDays(60), harvestEnd: plusDays(75) });
    expect(ok.status).toBe(201);
    expect(await ok.json()).toMatchObject({ harvestStart: plusDays(60), harvestEnd: plusDays(75) });
  });
});
