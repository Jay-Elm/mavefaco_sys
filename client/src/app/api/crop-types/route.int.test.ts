import { describe, expect, it } from "vitest";
import { GET as list, POST as create } from "./route";
import { DELETE as remove, PUT as put } from "./[id]/route";
import { GET as supply } from "@/app/api/admin/supply/route";
import { prisma } from "@/lib/prisma";
import { addDays, todayPH, weekStart } from "@/lib/planting";
import { createCropType, createPlanting, createUser, params, request, type SessionUser } from "@/test-utils/integration/helpers";

const pechay = { name: "Pechay", daysToHarvestMin: 30, daysToHarvestMax: 45, vegetativeDay: 7, floweringDay: null, fruitingDay: null };
const post = (as: SessionUser | undefined, body: unknown) => create(request("/api/crop-types", { method: "POST", as, body }));

describe("crop types", () => {
  it("staff add, correct and delete crops; every change is audited", async () => {
    const manager = await createUser({ role: "manager" });

    const res = await post(manager, pechay);
    expect(res.status).toBe(201);
    const crop = await res.json();

    const edited = await put(request(`/api/crop-types/${crop.id}`, { method: "PUT", as: manager, body: { ...pechay, daysToHarvestMax: 50 } }), params({ id: String(crop.id) }));
    expect(await edited.json()).toMatchObject({ daysToHarvestMax: 50 });

    expect((await post(manager, pechay)).status).toBe(409); // same name
    expect((await post(manager, { ...pechay, name: "Bad", vegetativeDay: 40 })).status).toBe(400);

    const deleted = await remove(request(`/api/crop-types/${crop.id}`, { method: "DELETE", as: manager }), params({ id: String(crop.id) }));
    expect(deleted.status).toBe(200);
    expect(await prisma.auditLog.findMany({ select: { action: true }, orderBy: { id: "asc" } })).toEqual([
      { action: "CREATE_CROP_TYPE" }, { action: "UPDATE_CROP_TYPE" }, { action: "DELETE_CROP_TYPE" },
    ]);
  });

  it("can't delete a crop that plantings use", async () => {
    const crop = await createCropType();
    await createPlanting((await createUser({ role: "farmer" })).id, { cropTypeId: crop.id });

    const res = await remove(request(`/api/crop-types/${crop.id}`, { method: "DELETE", as: await createUser({ role: "admin" }) }), params({ id: String(crop.id) }));

    expect(res.status).toBe(409);
    expect(await prisma.cropType.count()).toBe(1);
  });

  it("farmers can read the list but not change it; customers can't see it", async () => {
    const farmer = await createUser({ role: "farmer" });
    await createCropType({ name: "Okra" });

    expect(await (await list(request("/api/crop-types", { as: farmer }))).json()).toMatchObject([{ name: "Okra" }]);
    expect((await post(farmer, pechay)).status).toBe(403);
    expect((await list(request("/api/crop-types", { as: await createUser() }))).status).toBe(403);
    expect((await list(request("/api/crop-types"))).status).toBe(401);
  });
});

describe("GET /api/admin/supply", () => {
  const get = async (as: SessionUser) => supply(request("/api/admin/supply", { as }));

  it("adds up expected harvests by crop and week, and lists overdue plantings separately", async () => {
    const today = todayPH();
    const monday = weekStart(today);
    const tomato = await createCropType({ name: "Tomato" });
    const farmers = await Promise.all([1, 2, 3].map(() => createUser({ role: "farmer" })));
    // Next week, 7 days at 10 kg a day, for three farms.
    for (const f of farmers) {
      await createPlanting(f.id, { cropTypeId: tomato.id, harvestStart: addDays(monday, 7), harvestEnd: addDays(monday, 13), expectedYield: 70 });
    }
    const late = await createPlanting(farmers[0].id, { cropTypeId: tomato.id, harvestStart: addDays(today, -20), harvestEnd: addDays(today, -1) });
    await createPlanting(farmers[1].id, { cropTypeId: tomato.id, harvestStart: addDays(monday, 7), harvestEnd: addDays(monday, 13), status: "harvested" });
    const gone = await createUser({ role: "farmer" });
    await createPlanting(gone.id, { cropTypeId: tomato.id, harvestStart: addDays(monday, 7), harvestEnd: addDays(monday, 13) });
    await prisma.user.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });

    const res = await get(await createUser({ role: "manager" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.weeks[0]).toBe(monday);
    expect(body.weeks).toHaveLength(8);
    expect(body.crops).toHaveLength(1);
    expect(body.crops[0].weekly[1]).toEqual({ kg: 210, farms: 3, clash: true });
    expect(body.crops[0].plantings).toHaveLength(3);
    expect(body.crops[0].plantings[0]).toMatchObject({ farmer: { name: expect.any(String) }, expectedYield: 70 });
    expect(body.overdue.map((p: { id: number }) => p.id)).toEqual([late.id]);
  });

  it("is for managers and admins only", async () => {
    expect((await get(await createUser({ role: "admin" }))).status).toBe(200);
    expect((await get(await createUser({ role: "farmer" }))).status).toBe(403);
    expect((await get(await createUser())).status).toBe(403);
  });
});
