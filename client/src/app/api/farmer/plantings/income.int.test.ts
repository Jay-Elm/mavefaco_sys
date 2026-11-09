import { describe, expect, it } from "vitest";
import { GET as list, POST as create } from "./route";
import { GET as getOne, PATCH as patch } from "./[id]/route";
import { POST as harvest } from "./[id]/harvest/route";
import { prisma } from "@/lib/prisma";
import { createCropType, createPlanting, createProduct, createUser, params, request, type SessionUser } from "@/test-utils/integration/helpers";
import { todayPH } from "@/lib/planting";

const id = (n: number) => params({ id: String(n) });
const one = async (pid: number, as: SessionUser) => (await getOne(request(`/api/farmer/plantings/${pid}`, { as }), id(pid))).json();

/** A listing of this crop, sold by the given unit at the given price. */
async function listing(farmerId: number, cropTypeId: number, price: number, unit = "kg", extra: { archivedAt?: Date; updatedAt?: Date } = {}) {
  const p = await createProduct(farmerId, { price });
  return prisma.product.update({ where: { id: p.id }, data: { unit, cropTypeId, ...extra } });
}

async function psaPrice(cropTypeId: number, area: string, year: number, month: number, pricePerKg: number) {
  await prisma.marketPrice.create({ data: { cropTypeId, area, year, month, pricePerKg } });
}

describe("expected income on plantings", () => {
  it("prices the expected yield at the linked listing and at PSA's latest Albay farmgate price", async () => {
    const farmer = await createUser({ role: "farmer" });
    const crop = await createCropType();
    const tomatoes = await listing(farmer.id, crop.id, 60);
    await psaPrice(crop.id, "albay", 2026, 8, 40);
    await psaPrice(crop.id, "albay", 2026, 9, 42.5); // latest
    await psaPrice(crop.id, "bicol", 2026, 10, 50); // newer, but Albay comes first
    const planting = await createPlanting(farmer.id, { cropTypeId: crop.id, productId: tomatoes.id, expectedYield: 120 });

    expect((await one(planting.id, farmer)).income).toEqual({
      kg: 120,
      basis: "expected",
      own: { listing: { id: tomatoes.id, name: tomatoes.name }, pricePerKg: 60, amount: 7200 },
      psa: { area: "albay", month: "2026-09", pricePerKg: 42.5, amount: 5100 },
    });
  });

  it("uses Bicol's price when PSA has none for Albay", async () => {
    const farmer = await createUser({ role: "farmer" });
    const crop = await createCropType();
    await psaPrice(crop.id, "bicol", 2026, 7, 30);
    const planting = await createPlanting(farmer.id, { cropTypeId: crop.id, expectedYield: 10 });

    expect((await one(planting.id, farmer)).income).toMatchObject({ own: null, psa: { area: "bicol", amount: 300 } });
  });

  it("falls back to the farmer's newest live kilo listing of the crop, never another farmer's or a non-kilo one", async () => {
    const farmer = await createUser({ role: "farmer" });
    const other = await createUser({ role: "farmer" });
    const crop = await createCropType();
    const bundles = await listing(farmer.id, crop.id, 25, "bundle");
    await listing(farmer.id, crop.id, 70, "kg", { archivedAt: new Date() });
    await listing(other.id, crop.id, 99);
    await listing(farmer.id, crop.id, 50, "kg", { updatedAt: new Date("2026-01-01") });
    const newest = await listing(farmer.id, crop.id, 55, "kilo");
    // Linked to a listing sold by the bundle, which can't be priced per kilo.
    const planting = await createPlanting(farmer.id, { cropTypeId: crop.id, productId: bundles.id, expectedYield: 2 });

    expect((await one(planting.id, farmer)).income.own).toEqual({
      listing: { id: newest.id, name: newest.name }, pricePerKg: 55, amount: 110,
    });

    // Linked to a listing of another crop: its price isn't used for this one.
    const otherCrop = await createCropType();
    const bananas = await listing(farmer.id, otherCrop.id, 90);
    await prisma.planting.update({ where: { id: planting.id }, data: { productId: bananas.id } });
    expect((await one(planting.id, farmer)).income.own.listing.id).toBe(newest.id);
  });

  it("is null without an expected yield, and has no prices when none are known", async () => {
    const farmer = await createUser({ role: "farmer" });
    const noYield = await createPlanting(farmer.id, { expectedYield: null });
    const noPrice = await createPlanting(farmer.id, { expectedYield: 30 });

    expect((await one(noYield.id, farmer)).income).toBeNull();
    expect((await one(noPrice.id, farmer)).income).toEqual({ kg: 30, basis: "expected", own: null, psa: null });
  });

  it("comes back on the list and on every change, and follows the harvest", async () => {
    const farmer = await createUser({ role: "farmer" });
    const crop = await createCropType({ daysToHarvestMin: 30, daysToHarvestMax: 40 });
    const kilos = await listing(farmer.id, crop.id, 40);

    const created = await (await create(request("/api/farmer/plantings", {
      method: "POST", as: farmer, body: { cropTypeId: crop.id, plantedOn: todayPH(), expectedYield: 100, productId: kilos.id },
    }))).json();
    expect(created.income.own.amount).toBe(4000);

    const changed = await (await patch(request(`/api/farmer/plantings/${created.id}`, {
      method: "PATCH", as: farmer, body: { expectedYield: 150 },
    }), id(created.id))).json();
    expect(changed.income.own.amount).toBe(6000);

    const rows = await (await list(request("/api/farmer/plantings", { as: farmer }))).json();
    expect(rows.find((r: { id: number }) => r.id === created.id).income.own.amount).toBe(6000);

    const harvested = await (await harvest(request(`/api/farmer/plantings/${created.id}/harvest`, {
      method: "POST", as: farmer, body: { harvestedOn: todayPH(), actualYield: 80 },
    }), id(created.id))).json();
    expect(harvested.income).toMatchObject({ kg: 80, basis: "actual", own: { amount: 3200 } });
  });
});
