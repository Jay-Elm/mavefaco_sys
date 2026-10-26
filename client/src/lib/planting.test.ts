import { describe, expect, it } from "vitest";
import { addDays, attention, daysBetween, expectedSupply, growthStage, harvestWindow, progress, todayPH, weekStart, type StageSchedule } from "./planting";
import { cropLogCreateSchema, cropTypeSchema, plantingUpdateSchema } from "@/validators/crop";

const tomato = { vegetativeDay: 14, floweringDay: 35, fruitingDay: 50, daysToHarvestMin: 70, daysToHarvestMax: 90 };
const pechay = { vegetativeDay: 7, floweringDay: null, fruitingDay: null, daysToHarvestMin: 30, daysToHarvestMax: 45 };

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

describe("growth stage", () => {
  const planted = "2026-08-01";
  const { harvestStart } = harvestWindow(tomato, planted);
  const stageOn = (day: number, schedule: StageSchedule = tomato, start = harvestStart) =>
    growthStage(schedule, planted, start, addDays(planted, day));

  it("follows the crop type's schedule, a stage starting on its day", () => {
    expect(stageOn(0)).toBe("seedling");
    expect(stageOn(13)).toBe("seedling");
    expect(stageOn(14)).toBe("vegetative");
    expect(stageOn(35)).toBe("flowering");
    expect(stageOn(50)).toBe("fruiting");
    expect(stageOn(69)).toBe("fruiting");
    expect(stageOn(70)).toBe("harvest-ready");
  });

  it("skips flowering and fruiting for leafy crops", () => {
    const start = harvestWindow(pechay, planted).harvestStart;
    expect(stageOn(20, pechay, start)).toBe("vegetative");
    expect(stageOn(29, pechay, start)).toBe("vegetative");
    expect(stageOn(30, pechay, start)).toBe("harvest-ready");
  });

  it("is harvest-ready when the farmer's adjusted window opens, whatever the schedule says", () => {
    expect(stageOn(40, tomato, addDays(planted, 40))).toBe("harvest-ready");
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
  it("requires growth stages in order, before harvest", () => {
    expect(cropTypeSchema.safeParse({ name: "Tomato", ...tomato }).success).toBe(true);
    expect(cropTypeSchema.safeParse({ name: "Pechay", ...pechay }).success).toBe(true);
    const bad = (over: object) => cropTypeSchema.safeParse({ name: "X", ...tomato, ...over }).error?.issues[0].path[0];
    expect(bad({ daysToHarvestMax: 60 })).toBe("daysToHarvestMax");
    expect(bad({ floweringDay: 10 })).toBe("floweringDay");
    expect(bad({ fruitingDay: 30 })).toBe("fruitingDay");
    expect(bad({ floweringDay: null })).toBe("fruitingDay"); // fruiting without flowering
    expect(bad({ vegetativeDay: 70 })).toBe("vegetativeDay");
  });

  it("rejects impossible and future dates, and a harvest window that ends before it starts", () => {
    expect(plantingUpdateSchema.safeParse({ plantedOn: "2026-02-30" }).success).toBe(false);
    expect(plantingUpdateSchema.safeParse({ plantedOn: addDays(todayPH(), 1) }).success).toBe(false);
    expect(plantingUpdateSchema.safeParse({ harvestStart: "2026-10-10", harvestEnd: "2026-10-09" }).success).toBe(false);
    expect(plantingUpdateSchema.safeParse({ harvestStart: "2026-10-10" }).success).toBe(false);
    expect(plantingUpdateSchema.safeParse({ harvestStart: "2026-10-10", harvestEnd: "2026-10-10" }).success).toBe(true);
  });

  it("asks for severity on problems and the pest on pest reports, and drops them where they don't apply", () => {
    const log = { note: "Seen on leaves", observedOn: "2026-10-01" };
    expect(cropLogCreateSchema.safeParse({ ...log, type: "pest_disease", severity: "high" }).success).toBe(false);
    expect(cropLogCreateSchema.safeParse({ ...log, type: "damage" }).success).toBe(false);
    expect(cropLogCreateSchema.parse({ ...log, type: "note", severity: "high", pest: "aphids" })).toMatchObject({ severity: null, pest: null });
    expect(cropLogCreateSchema.parse({ ...log, type: "damage", severity: "low", pest: "aphids" })).toMatchObject({ severity: "low", pest: null });
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
