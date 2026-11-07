import { describe, expect, it } from "vitest";
import { marketAlerts, marketByCrop, signalFor, suggestedCrops, type CropInfo, type SaleLine } from "./market";
import { searchCrops, suggestCropType } from "./cropKeywords";

const TODAY = "2026-11-07";
const okra: CropInfo = { id: 1, name: "Okra", daysToHarvestMin: 60, daysToHarvestMax: 75 };
const pechay: CropInfo = { id: 2, name: "Pechay", daysToHarvestMin: 20, daysToHarvestMax: 25 };
const sale = (cropTypeId: number, orderedOn: string, quantity: number, unit = "kg", price = 80): SaleLine => ({ cropTypeId, orderedOn, quantity, unit, price });

describe("signalFor", () => {
  it("needs enough sales to judge", () => {
    expect(signalFor(2, 0)).toBe("not-enough-data");
    expect(signalFor(2, 30)).toBe("no-recent-demand");
    expect(signalFor(0, 30, true)).toBe("other-units");
  });
  it("compares planned kilos with recent kilos", () => {
    expect(signalFor(40, 20)).toBe("demand-above-supply"); // 50%
    expect(signalFor(40, 30)).toBe("balanced"); // 75%
    expect(signalFor(40, 60)).toBe("balanced"); // 150%
    expect(signalFor(40, 61)).toBe("oversupply");
  });
});

describe("marketByCrop", () => {
  const sales = [
    sale(1, "2026-11-01", 20, "kg", 90), // last 4 weeks
    sale(1, "2026-10-20", 10, "kg", 70), // last 4 weeks
    sale(1, "2026-09-20", 5, "kg", 60), // weeks 5 to 8
    sale(1, "2026-08-01", 50), // older than 8 weeks: price history only
    sale(2, "2026-11-02", 12, "bundle", 25),
  ];
  const [o, p] = marketByCrop([okra, pechay], sales, [{ cropTypeId: 1, kg: 10, farms: 2 }], TODAY);

  it("counts the last 8 weeks of kilos as demand, against planned supply", () => {
    expect(o.demand).toEqual({ kg: 35, other: {}, orders: 3 });
    expect(o.supply).toEqual({ kg: 10, farms: 2 });
    expect(o.signal).toBe("demand-above-supply");
    expect(o.gapKg).toBe(25);
    expect(o.pricePerKg).toBeCloseTo((20 * 90 + 10 * 70 + 5 * 60) / 35, 2);
  });

  it("flags demand rising when the last 4 weeks outsell the 4 before", () => {
    expect(o.risingDemand).toBe(true); // 30 kg against 5 kg
  });

  it("keeps other units apart and doesn't compare them with kilos", () => {
    expect(p.demand).toEqual({ kg: 0, other: { bundle: 12 }, orders: 1 });
    expect(p.signal).toBe("other-units");
    expect(p.pricePerKg).toBeNull();
    expect(p.risingDemand).toBe(true); // 12 bundles against none
  });

  it("averages the price per kilo by month, months with sales only", () => {
    expect(o.prices.map((m) => m.month)).toEqual(["2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(o.prices[0]).toEqual({ month: "2026-08", pricePerKg: 80, kg: 50 });
  });

  it("gives the harvest window of a planting made today", () => {
    expect(o.plantTodayHarvest).toEqual({ from: "2027-01-06", to: "2027-01-21" });
  });

  it("raises alerts and suggests the crop with room to plant", () => {
    const alerts = marketAlerts([o, p]);
    expect(alerts.map((a) => `${a.kind}:${a.crop}`)).toEqual(["low-supply:Okra", "high-demand:Okra", "high-demand:Pechay"]);
    expect(suggestedCrops([o, p]).map((r) => r.crop.name)).toEqual(["Okra"]);
  });
});

describe("suggestCropType", () => {
  const crops = [
    { id: 1, name: "Upo", aliases: ["upo", "bottle gourd"] },
    { id: 2, name: "Sitaw", aliases: ["sitaw", "string beans", "balatong"] },
    { id: 3, name: "Siling Labuyo", aliases: ["siling labuyo", "chili", "sili"] },
    { id: 4, name: "Eggplant", aliases: ["eggplant", "talong"] },
    { id: 5, name: "Tomato", aliases: ["tomato", "kamatis"] },
    { id: 6, name: "Rare Crop" },
    { id: 7, name: "Pechay", aliases: ["pechay", "petsay"] },
    { id: 8, name: "Pechay Baguio", aliases: ["pechay baguio", "wombok"] },
    { id: 9, name: "Potato", aliases: ["potato", "patatas"] },
    { id: 10, name: "Chili Leaves", aliases: ["chili leaves", "dahon ng sili"] },
  ];
  it("matches English and Filipino names", () => {
    expect(suggestCropType("Fresh String Beans", crops)?.name).toBe("Sitaw");
    expect(suggestCropType("Talong (long purple)", crops)?.name).toBe("Eggplant");
    expect(suggestCropType("Kamatis", crops)?.name).toBe("Tomato");
    expect(suggestCropType("Chili Pepper", crops)?.name).toBe("Siling Labuyo");
  });
  it("matches short words only as whole words", () => {
    expect(suggestCropType("Upo, young", crops)?.name).toBe("Upo");
    expect(suggestCropType("Kapuso special", crops)).toBeNull();
  });
  it("uses the crop's own name for crops staff added", () => {
    expect(suggestCropType("rare crop bundle", crops)?.name).toBe("Rare Crop");
  });
  it("prefers the most specific name", () => {
    expect(suggestCropType("Fresh Pechay Baguio", crops)?.name).toBe("Pechay Baguio");
    expect(suggestCropType("Pechay (native)", crops)?.name).toBe("Pechay");
    expect(suggestCropType("Chili leaves, 1 bundle", crops)?.name).toBe("Chili Leaves");
  });
  it("suggests nothing when unsure", () => {
    expect(suggestCropType("Tomato and potato mix", crops)).toBeNull(); // equally specific
    expect(suggestCropType("", crops)).toBeNull();
  });
});

describe("searchCrops", () => {
  const crops = [
    { id: 1, name: "Eggplant", aliases: ["eggplant", "talong"] },
    { id: 2, name: "Ampalaya", aliases: ["ampalaya", "bitter gourd"] },
    { id: 3, name: "Ampalaya Leaves", aliases: ["dahon ng ampalaya"] },
  ];
  it("finds crops by any of their names, saying which one matched", () => {
    expect(searchCrops("talong", crops)).toEqual([{ crop: crops[0], via: "talong" }]);
    expect(searchCrops("ampa", crops).map((x) => x.crop.name)).toEqual(["Ampalaya", "Ampalaya Leaves"]);
    expect(searchCrops("", crops)).toHaveLength(3);
  });
});
