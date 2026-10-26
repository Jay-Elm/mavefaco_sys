import { describe, expect, it } from "vitest";
import { withComingSoon } from "./comingSoon";
import { addDays, todayPH } from "./planting";
import { createPlanting, createProduct, createUser } from "@/test-utils/integration/helpers";

const day = (n: number) => addDays(todayPH(), n);

describe("withComingSoon", () => {
  it("gives an out-of-stock listing the earliest harvest window of its growing plantings", async () => {
    const farmer = await createUser({ role: "farmer" });
    const empty = await createProduct(farmer.id, { stock: 0 });
    await createPlanting(farmer.id, { productId: empty.id, harvestStart: day(20), harvestEnd: day(30) });
    await createPlanting(farmer.id, { productId: empty.id, harvestStart: day(5), harvestEnd: day(15) });

    const [result] = await withComingSoon([empty]);

    expect(result.comingSoon).toEqual({ harvestStart: day(5), harvestEnd: day(15) });
  });

  it("leaves it out for listings in stock, and for harvests that are over, failed or already recorded", async () => {
    const farmer = await createUser({ role: "farmer" });
    const inStock = await createProduct(farmer.id, { stock: 4 });
    await createPlanting(farmer.id, { productId: inStock.id });
    const passed = await createProduct(farmer.id, { stock: 0 });
    await createPlanting(farmer.id, { productId: passed.id, harvestStart: day(-10), harvestEnd: day(-1) });
    const done = await createProduct(farmer.id, { stock: 0 });
    await createPlanting(farmer.id, { productId: done.id, status: "harvested" });
    await createPlanting(farmer.id, { productId: done.id, status: "failed" });
    const unlinked = await createProduct(farmer.id, { stock: 0 });
    await createPlanting(farmer.id);

    const results = await withComingSoon([inStock, passed, done, unlinked]);

    expect(results.map((r) => r.comingSoon)).toEqual([null, null, null, null]);
  });

  it("still shows a window that has opened but not closed", async () => {
    const farmer = await createUser({ role: "farmer" });
    const p = await createProduct(farmer.id, { stock: 0 });
    await createPlanting(farmer.id, { productId: p.id, harvestStart: day(-3), harvestEnd: day(4) });

    expect((await withComingSoon([p]))[0].comingSoon).toEqual({ harvestStart: day(-3), harvestEnd: day(4) });
  });
});
