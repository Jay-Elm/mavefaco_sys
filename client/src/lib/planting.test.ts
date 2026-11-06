import { describe, expect, it } from "vitest";
import { addDays, attention, daysBetween, expectedSupply, harvestBoard, harvestWindow, progress, todayPH, weekStart } from "./planting";
import { cropLogCreateSchema, cropTypeSchema, plantingUpdateSchema } from "@/validators/crop";

const tomato = { daysToHarvestMin: 70, daysToHarvestMax: 90 };

describe("calendar dates", () => {
  it("takes today in Philippine time, not UTC", () => {
    expect(todayPH(new Date("2026-10-26T15:59:00Z"))).toBe("2026-10-26");
    expect(todayPH(new Date("2026-10-26T16:00:00Z"))).toBe("2026-10-27"); // midnight in Manila
  });

  it("adds and counts days across month and year ends", () => {
    expect(addDays("2026-12-25", 10)).toBe("2027-01-04");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(daysBetween("2026-12-25", "2027-01-04")).toBe(10);
    expect(daysBetween("2027-01-04", "2026-12-25")).toBe(-10);
  });

  it("finds the Monday of a date's week", () => {
    expect(weekStart("2026-10-26")).toBe("2026-10-26"); // a Monday
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // the Sunday after
    expect(weekStart("2026-10-27")).toBe("2026-10-26");
  });
});

describe("harvest window and attention", () => {
  it("comes from the crop type's days to harvest", () => {
    expect(harvestWindow(tomato, "2026-08-01")).toEqual({ harvestStart: "2026-10-10", harvestEnd: "2026-10-30" });
  });

  it("flags plantings to harvest now, and overdue ones once the window has closed", () => {
    expect(attention("2026-10-10", "2026-10-30", "2026-10-09")).toBeNull();
    expect(attention("2026-10-10", "2026-10-30", "2026-10-10")).toBe("harvest-now");
    expect(attention("2026-10-10", "2026-10-30", "2026-10-30")).toBe("harvest-now");
    expect(attention("2026-10-10", "2026-10-30", "2026-10-31")).toBe("overdue");
  });

  it("measures progress toward the harvest window, clamped to 0–1", () => {
    expect(progress("2026-08-01", "2026-08-11", "2026-08-06")).toBe(0.5);
    expect(progress("2026-08-01", "2026-08-11", "2026-07-01")).toBe(0);
    expect(progress("2026-08-01", "2026-08-11", "2026-09-01")).toBe(1);
  });
});

describe("crop validation", () => {
  it("needs a harvest range whose end isn't before its start", () => {
    expect(cropTypeSchema.safeParse({ name: "Tomato", ...tomato }).success).toBe(true);
    expect(cropTypeSchema.safeParse({ name: "Pechay", daysToHarvestMin: 30, daysToHarvestMax: 30 }).success).toBe(true);
    const bad = (over: object) => cropTypeSchema.safeParse({ name: "X", ...tomato, ...over }).error?.issues[0].path[0];
    expect(bad({ daysToHarvestMax: 60 })).toBe("daysToHarvestMax");
    expect(bad({ daysToHarvestMin: 0 })).toBe("daysToHarvestMin");
  });

  it("takes an optional source, and a blank one clears it", () => {
    const parse = (source: unknown) => cropTypeSchema.parse({ name: "Okra", daysToHarvestMin: 60, daysToHarvestMax: 75, source }).source;
    expect(parse("  DA Bicol (2021)  ")).toBe("DA Bicol (2021)");
    expect(parse("   ")).toBeNull();
    // Left out: unchanged on an edit.
    expect(parse(undefined)).toBeUndefined();
    expect(cropTypeSchema.safeParse({ name: "Okra", daysToHarvestMin: 60, daysToHarvestMax: 75, source: "x".repeat(301) }).success).toBe(false);
  });

  it("rejects impossible and future dates, and a harvest window that ends before it starts", () => {
    expect(plantingUpdateSchema.safeParse({ plantedOn: "2026-02-30" }).success).toBe(false);
    expect(plantingUpdateSchema.safeParse({ plantedOn: addDays(todayPH(), 1) }).success).toBe(false);
    expect(plantingUpdateSchema.safeParse({ harvestStart: "2026-10-10", harvestEnd: "2026-10-09" }).success).toBe(false);
    expect(plantingUpdateSchema.safeParse({ harvestStart: "2026-10-10" }).success).toBe(false);
    expect(plantingUpdateSchema.safeParse({ harvestStart: "2026-10-10", harvestEnd: "2026-10-10" }).success).toBe(true);
  });

  it("takes a type, a note and the date seen, and nothing else", () => {
    const log = { note: "Seen on leaves", observedOn: "2026-10-01" };
    expect(cropLogCreateSchema.parse({ ...log, type: "pest_disease", severity: "high", pest: "aphids" })).toEqual({ ...log, type: "pest_disease" });
    expect(cropLogCreateSchema.safeParse({ ...log, type: "flood" }).success).toBe(false);
    expect(cropLogCreateSchema.safeParse({ ...log, type: "note", note: " " }).success).toBe(false);
  });
});

describe("expected supply", () => {
  const farmer = (id: number) => ({ id, name: `Farmer ${id}` });
  const tomatoType = { id: 1, name: "Tomato" };
  const pechayType = { id: 2, name: "Pechay" };
  const planting = (id: number, over: Partial<{ farmer: { id: number; name: string }; cropType: { id: number; name: string }; harvestStart: string; harvestEnd: string; expectedYield: number | null }>) => ({
    id, farmer: farmer(id), cropType: tomatoType, harvestStart: "2026-10-26", harvestEnd: "2026-11-01", expectedYield: 70, ...over,
  });
  const today = "2026-10-26"; // a Monday

  it("spreads each planting's yield evenly over its harvest window, week by week", () => {
    const { weeks, crops } = expectedSupply([planting(1, { harvestStart: "2026-10-30", harvestEnd: "2026-11-05", expectedYield: 70 })], today, 3);
    expect(weeks).toEqual(["2026-10-26", "2026-11-02", "2026-11-09"]);
    // 7 days at 10 kg: Oct 30–Nov 1 in week 1, Nov 2–5 in week 2.
    expect(crops[0].weekly.map((w) => w.kg)).toEqual([30, 40, 0]);
    expect(crops[0].totalKg).toBe(70);
  });

  it("counts only the days left when the window has already opened", () => {
    const { crops } = expectedSupply([planting(1, { harvestStart: "2026-10-20", harvestEnd: "2026-10-30", expectedYield: 50 })], "2026-10-28", 1);
    expect(crops[0].weekly[0].kg).toBe(50); // Oct 28–30, all still to come
  });

  it("groups by crop, flags a week when enough farms harvest the same crop, and counts plantings without a yield", () => {
    const { crops, withoutYield } = expectedSupply(
      [
        planting(1, {}),
        planting(2, {}),
        planting(3, { expectedYield: null }),
        planting(4, { cropType: pechayType, expectedYield: 5 }),
      ],
      today,
      2,
    );
    expect(crops.map((c) => c.cropType.name)).toEqual(["Tomato", "Pechay"]); // most expected first
    expect(crops[0].weekly[0]).toEqual({ kg: 140, farms: 3, clash: true });
    expect(crops[0].weekly[1]).toEqual({ kg: 0, farms: 0, clash: false });
    expect(crops[1].weekly[0]).toEqual({ kg: 5, farms: 1, clash: false });
    expect(withoutYield).toBe(1);
  });

  it("leaves out plantings harvested after the last week shown", () => {
    const { crops } = expectedSupply([planting(1, { harvestStart: "2027-01-01", harvestEnd: "2027-01-10" })], today, 8);
    expect(crops).toEqual([]);
  });
});

describe("harvest board", () => {
  const tomato = { id: 1, name: "Tomato" };
  const pechay = { id: 2, name: "Pechay" };
  const okra = { id: 3, name: "Okra" };
  const planting = (id: number, farmerId: number, cropType: { id: number; name: string }, harvestStart: string, harvestEnd: string, expectedYield: number | null = 70) => ({
    id, farmer: { id: farmerId, name: `Farmer ${farmerId}` }, cropType, harvestStart, harvestEnd, expectedYield,
  });
  const today = "2026-10-28"; // a Wednesday; this week is Oct 26 – Nov 1

  it("lists this week's crops by expected kilograms, counting each farm once", () => {
    const { thisWeek } = harvestBoard(
      [
        planting(1, 1, tomato, "2026-10-29", "2026-10-31", 30),
        planting(2, 1, tomato, "2026-10-30", "2026-10-30", 10),
        planting(3, 2, pechay, "2026-10-28", "2026-10-29", 60),
        planting(4, 3, tomato, "2026-10-31", "2026-11-01", null),
      ],
      today,
    );
    expect(thisWeek).toEqual([
      { crop: "Pechay", farms: 1, kg: 60 },
      { crop: "Tomato", farms: 2, kg: 40 },
    ]);
  });

  it("names next week's crops only when they don't also harvest this week", () => {
    const { thisWeek, nextWeek } = harvestBoard(
      [
        planting(1, 1, tomato, "2026-10-30", "2026-11-04"),
        planting(2, 2, okra, "2026-11-03", "2026-11-06"),
        planting(3, 3, pechay, "2026-11-20", "2026-11-25"),
      ],
      today,
    );
    expect(thisWeek.map((r) => r.crop)).toEqual(["Tomato"]);
    expect(nextWeek).toEqual(["Okra"]);
  });

  it("is empty when nothing is due in the next two weeks", () => {
    expect(harvestBoard([planting(1, 1, tomato, "2026-12-01", "2026-12-05")], today)).toEqual({ thisWeek: [], nextWeek: [] });
  });
});
