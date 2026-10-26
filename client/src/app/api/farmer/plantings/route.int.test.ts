import { describe, expect, it } from "vitest";
import { GET as list, POST as create } from "./route";
import { DELETE as remove, GET as getOne, PATCH as patch } from "./[id]/route";
import { POST as harvest } from "./[id]/harvest/route";
import { POST as addLog } from "./[id]/logs/route";
import { DELETE as removeLog } from "./[id]/logs/[logId]/route";
import { prisma } from "@/lib/prisma";
import { addDays, todayPH } from "@/lib/planting";
import { deleteUserAccount } from "@/lib/deleteAccount";
import {
  createCropType, createPlanting, createProduct, createUser, params, request, withRowLocked, type SessionUser,
} from "@/test-utils/integration/helpers";

const today = () => todayPH();
const day = (n: number) => addDays(today(), n);
const id = (n: number) => params({ id: String(n) });

const post = (as: SessionUser | undefined, body: unknown) => create(request("/api/farmer/plantings", { method: "POST", as, body }));
const update = (pid: number, as: SessionUser, body: unknown) =>
  patch(request(`/api/farmer/plantings/${pid}`, { method: "PATCH", as, body }), id(pid));
const harvestIt = (pid: number, as: SessionUser, body: unknown) =>
  harvest(request(`/api/farmer/plantings/${pid}/harvest`, { method: "POST", as, body }), id(pid));
const log = (pid: number, as: SessionUser, body: unknown) =>
  addLog(request(`/api/farmer/plantings/${pid}/logs`, { method: "POST", as, body }), id(pid));

describe("POST /api/farmer/plantings", () => {
  it("records a planting with the harvest window its crop type gives", async () => {
    const farmer = await createUser({ role: "farmer" });
    const tomato = await createCropType({ name: "Tomato", daysToHarvestMin: 70, daysToHarvestMax: 90 });

    const res = await post(farmer, { cropTypeId: tomato.id, plantedOn: day(-10), areaSqm: 200, expectedYield: 300 });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      plantedOn: day(-10), harvestStart: day(60), harvestEnd: day(80), status: "growing",
      stage: "seedling", attention: null, areaSqm: 200, expectedYield: 300, cropType: { name: "Tomato" },
    });
  });

  it("only links the farmer's own live listing, and doesn't take a future planting date", async () => {
    const farmer = await createUser({ role: "farmer" });
    const other = await createUser({ role: "farmer" });
    const crop = await createCropType();
    const theirs = await createProduct(other.id);
    const archived = await prisma.product.update({ where: { id: (await createProduct(farmer.id)).id }, data: { archivedAt: new Date() } });
    const mine = await createProduct(farmer.id);

    expect((await post(farmer, { cropTypeId: crop.id, plantedOn: today(), productId: theirs.id })).status).toBe(400);
    expect((await post(farmer, { cropTypeId: crop.id, plantedOn: today(), productId: archived.id })).status).toBe(400);
    expect((await post(farmer, { cropTypeId: crop.id, plantedOn: day(1) })).status).toBe(400);
    expect((await post(farmer, { cropTypeId: 999_999, plantedOn: today() })).status).toBe(400);
    const ok = await post(farmer, { cropTypeId: crop.id, plantedOn: today(), productId: mine.id });
    expect(await ok.json()).toMatchObject({ product: { id: mine.id } });
  });

  it("is for farmers only", async () => {
    const crop = await createCropType();
    expect((await post(undefined, { cropTypeId: crop.id, plantedOn: today() })).status).toBe(401);
    for (const role of ["customer", "manager", "admin"] as const) {
      expect((await post(await createUser({ role }), { cropTypeId: crop.id, plantedOn: today() })).status).toBe(403);
    }
  });
});

describe("GET /api/farmer/plantings", () => {
  it("lists only the farmer's own plantings, with what needs attention worked out for today", async () => {
    const farmer = await createUser({ role: "farmer" });
    const due = await createPlanting(farmer.id, { harvestStart: day(-2), harvestEnd: day(5) });
    const late = await createPlanting(farmer.id, { harvestStart: day(-20), harvestEnd: day(-1) });
    const done = await createPlanting(farmer.id, { status: "harvested" });
    await prisma.cropLog.create({
      data: { plantingId: due.id, type: "pest_disease", pest: "aphids", severity: "high", note: "Spreading", observedOn: new Date() },
    });
    await createPlanting((await createUser({ role: "farmer" })).id);

    const rows = await (await list(request("/api/farmer/plantings", { as: farmer }))).json();

    const byId = Object.fromEntries(rows.map((r: { id: number }) => [r.id, r]));
    expect(rows).toHaveLength(3);
    expect(byId[due.id]).toMatchObject({ stage: "harvest-ready", attention: "harvest-now", latestHighSeverity: { pest: "aphids" } });
    expect(byId[late.id]).toMatchObject({ attention: "overdue", latestHighSeverity: null });
    expect(byId[done.id]).toMatchObject({ status: "harvested", stage: null, attention: null });
  });
});

describe("PATCH /api/farmer/plantings/[id]", () => {
  it("moves the harvest window with a corrected planting date, or takes the farmer's own window", async () => {
    const farmer = await createUser({ role: "farmer" });
    const p = await createPlanting(farmer.id, { plantedOn: day(-30), harvestStart: day(40), harvestEnd: day(60) });

    expect(await (await update(p.id, farmer, { plantedOn: day(-25) })).json()).toMatchObject({ harvestStart: day(45), harvestEnd: day(65) });
    expect(await (await update(p.id, farmer, { harvestStart: day(50), harvestEnd: day(55) })).json()).toMatchObject({ harvestStart: day(50), harvestEnd: day(55) });
    expect((await update(p.id, farmer, { harvestStart: day(-26), harvestEnd: day(-20) })).status).toBe(400); // before planting
  });

  it("marks only a growing planting failed, and going back to growing undoes a recorded harvest", async () => {
    const farmer = await createUser({ role: "farmer" });
    const p = await createPlanting(farmer.id);
    expect(await (await update(p.id, farmer, { status: "failed" })).json()).toMatchObject({ status: "failed" });
    expect((await update(p.id, farmer, { status: "failed" })).status).toBe(409);

    const h = await createPlanting(farmer.id);
    await harvestIt(h.id, farmer, { harvestedOn: today(), actualYield: 80 });
    expect(await (await update(h.id, farmer, { status: "growing" })).json()).toMatchObject({ status: "growing", harvestedOn: null, actualYield: null });
    expect((await update(h.id, farmer, { status: "harvested" })).status).toBe(400); // only through /harvest
  });

  it("can't see or change another farmer's planting", async () => {
    const owner = await createUser({ role: "farmer" });
    const other = await createUser({ role: "farmer" });
    const p = await createPlanting(owner.id);

    expect((await getOne(request(`/api/farmer/plantings/${p.id}`, { as: other }), id(p.id))).status).toBe(404);
    expect((await update(p.id, other, { status: "failed" })).status).toBe(404);
    expect((await remove(request(`/api/farmer/plantings/${p.id}`, { method: "DELETE", as: other }), id(p.id))).status).toBe(404);
    expect((await harvestIt(p.id, other, { harvestedOn: today() })).status).toBe(404);
    expect((await log(p.id, other, { type: "note", note: "Hi", observedOn: today() })).status).toBe(404);
    expect(await prisma.planting.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ status: "growing" });
  });
});

describe("POST /api/farmer/plantings/[id]/harvest", () => {
  it("records the harvest and adds to the linked listing's stock without sending it back for review", async () => {
    const farmer = await createUser({ role: "farmer" });
    const product = await createProduct(farmer.id, { stock: 5 });
    const p = await createPlanting(farmer.id, { productId: product.id, plantedOn: day(-80) });

    const res = await harvestIt(p.id, farmer, { harvestedOn: today(), actualYield: 120, addToStock: 100 });

    expect(await res.json()).toMatchObject({ status: "harvested", harvestedOn: today(), actualYield: 120 });
    expect(await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ stock: 105, approved: true });
  });

  it("changes nothing when the stock can't be added", async () => {
    const farmer = await createUser({ role: "farmer" });
    const unlinked = await createPlanting(farmer.id);
    const product = await createProduct(farmer.id, { stock: 5 });
    const linked = await createPlanting(farmer.id, { productId: product.id });
    await prisma.product.update({ where: { id: product.id }, data: { archivedAt: new Date() } });

    expect((await harvestIt(unlinked.id, farmer, { harvestedOn: today(), addToStock: 10 })).status).toBe(400);
    expect((await harvestIt(linked.id, farmer, { harvestedOn: today(), addToStock: 10 })).status).toBe(409);
    expect(await prisma.planting.count({ where: { status: "growing" } })).toBe(2);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(5);
  });

  it("records a harvest once when it's submitted twice at the same time", async () => {
    const farmer = await createUser({ role: "farmer" });
    const product = await createProduct(farmer.id, { stock: 0 });
    const p = await createPlanting(farmer.id, { productId: product.id });

    const results = await withRowLocked("Planting", p.id, 2, () =>
      Promise.all([1, 2].map(() => harvestIt(p.id, farmer, { harvestedOn: today(), addToStock: 50 }))),
    );

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(50);
  });

  it("doesn't take a harvest date before the planting date", async () => {
    const farmer = await createUser({ role: "farmer" });
    const p = await createPlanting(farmer.id, { plantedOn: day(-5) });
    expect((await harvestIt(p.id, farmer, { harvestedOn: day(-6) })).status).toBe(400);
  });
});

describe("crop logs", () => {
  it("records structured reports and deletes the farmer's own", async () => {
    const farmer = await createUser({ role: "farmer" });
    const p = await createPlanting(farmer.id, { plantedOn: day(-30) });

    const res = await log(p.id, farmer, { type: "pest_disease", pest: "whitefly", severity: "medium", note: "Under leaves", observedOn: day(-2) });
    expect(res.status).toBe(201);
    const entry = await res.json();
    expect(entry).toMatchObject({ pest: "whitefly", severity: "medium", observedOn: day(-2) });

    expect((await log(p.id, farmer, { type: "pest_disease", severity: "low", note: "?", observedOn: today() })).status).toBe(400); // which pest?
    expect((await log(p.id, farmer, { type: "damage", severity: "low", note: "Wind", observedOn: day(-31) })).status).toBe(400); // before planting

    const other = await createUser({ role: "farmer" });
    const del = (as: SessionUser) =>
      removeLog(request("/x", { method: "DELETE", as }), params({ id: String(p.id), logId: String(entry.id) }));
    expect((await del(other)).status).toBe(404);
    expect((await del(farmer)).status).toBe(200);
    expect(await prisma.cropLog.count()).toBe(0);
  });

  it("go with their planting when it's deleted", async () => {
    const farmer = await createUser({ role: "farmer" });
    const p = await createPlanting(farmer.id);
    await log(p.id, farmer, { type: "note", note: "Watered", observedOn: today() });

    const res = await remove(request(`/api/farmer/plantings/${p.id}`, { method: "DELETE", as: farmer }), id(p.id));

    expect(res.status).toBe(200);
    expect(await prisma.cropLog.count()).toBe(0);
  });
});

describe("account deletion", () => {
  it("removes a farmer's plantings and logs", async () => {
    const farmer = await createUser({ role: "farmer" });
    const p = await createPlanting(farmer.id);
    await prisma.cropLog.create({ data: { plantingId: p.id, type: "note", note: "Mine", observedOn: new Date() } });
    const keep = await createPlanting((await createUser({ role: "farmer" })).id);

    expect(await deleteUserAccount(farmer.id)).toMatchObject({ ok: true });

    expect(await prisma.planting.findMany({ select: { id: true } })).toEqual([{ id: keep.id }]);
    expect(await prisma.cropLog.count()).toBe(0);
  });
});
