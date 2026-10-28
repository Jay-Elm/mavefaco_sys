// Calendar-date arithmetic and growth-stage logic for crop plantings.
// Planting dates are calendar dates in Philippine time, passed around as
// "YYYY-MM-DD" strings; Prisma returns @db.Date columns as UTC midnight.

const DAY_MS = 24 * 60 * 60 * 1000;
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Today's date in the Philippines, as "YYYY-MM-DD". */
export function todayPH(now: Date = new Date()): string {
  return new Date(now.getTime() + PH_OFFSET_MS).toISOString().slice(0, 10);
}

/** A @db.Date value (UTC midnight) as "YYYY-MM-DD". */
export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" as the Date Prisma stores in a @db.Date column. */
export function fromDateString(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function addDays(date: string, days: number): string {
  return toDateString(new Date(fromDateString(date).getTime() + days * DAY_MS));
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((fromDateString(to).getTime() - fromDateString(from).getTime()) / DAY_MS);
}

/** The Monday on or before `date`. */
export function weekStart(date: string): string {
  const day = fromDateString(date).getUTCDay(); // 0 = Sunday
  return addDays(date, -((day + 6) % 7));
}

export const GROWTH_STAGES = ["seedling", "vegetative", "flowering", "fruiting", "harvest-ready"] as const;
export type GrowthStage = (typeof GROWTH_STAGES)[number];

export interface StageSchedule {
  vegetativeDay: number;
  floweringDay: number | null;
  fruitingDay: number | null;
}

/**
 * The stage a growing planting is in today: harvest-ready once its harvest
 * window opens, otherwise the latest stage whose start day has passed.
 */
export function growthStage(schedule: StageSchedule, plantedOn: string, harvestStart: string, today: string): GrowthStage {
  if (today >= harvestStart) return "harvest-ready";
  const day = daysBetween(plantedOn, today);
  if (schedule.fruitingDay !== null && day >= schedule.fruitingDay) return "fruiting";
  if (schedule.floweringDay !== null && day >= schedule.floweringDay) return "flowering";
  if (day >= schedule.vegetativeDay) return "vegetative";
  return "seedling";
}

/** The harvest window a crop type gives a planting. */
export function harvestWindow(
  cropType: { daysToHarvestMin: number; daysToHarvestMax: number },
  plantedOn: string,
): { harvestStart: string; harvestEnd: string } {
  return {
    harvestStart: addDays(plantedOn, cropType.daysToHarvestMin),
    harvestEnd: addDays(plantedOn, cropType.daysToHarvestMax),
  };
}

/** What a growing planting needs from its farmer, if anything. */
export type Attention = "harvest-now" | "overdue" | null;

export function attention(harvestStart: string, harvestEnd: string, today: string): Attention {
  if (today > harvestEnd) return "overdue";
  if (today >= harvestStart) return "harvest-now";
  return null;
}

/** How far a planting is from planting to the opening of its harvest window, 0–1. */
export function progress(plantedOn: string, harvestStart: string, today: string): number {
  const total = daysBetween(plantedOn, harvestStart);
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, daysBetween(plantedOn, today) / total));
}

/** What a planting is returned with: its crop type and linked listing. */
export const plantingInclude = {
  cropType: true,
  product: { select: { id: true, name: true, unit: true, archivedAt: true } },
} as const;

type PlantingRow = {
  plantedOn: Date;
  harvestStart: Date;
  harvestEnd: Date;
  harvestedOn: Date | null;
  status: string;
  cropType: StageSchedule & { id: number; name: string; daysToHarvestMin: number; daysToHarvestMax: number };
};

/**
 * A planting as the API returns it: dates as "YYYY-MM-DD", plus the stage,
 * attention flag and progress worked out for today (growing plantings only).
 */
export function serializePlanting<T extends PlantingRow>(p: T, today: string = todayPH()) {
  const plantedOn = toDateString(p.plantedOn);
  const harvestStart = toDateString(p.harvestStart);
  const harvestEnd = toDateString(p.harvestEnd);
  const growing = p.status === "growing";
  return {
    ...p,
    plantedOn,
    harvestStart,
    harvestEnd,
    harvestedOn: p.harvestedOn ? toDateString(p.harvestedOn) : null,
    stage: growing ? growthStage(p.cropType, plantedOn, harvestStart, today) : null,
    attention: growing ? attention(harvestStart, harvestEnd, today) : null,
    progress: growing ? progress(plantedOn, harvestStart, today) : null,
    day: daysBetween(plantedOn, today),
  };
}

// --- Expected supply (Dashboard -> Upcoming Supply) ---------------------------

/** How many weeks ahead the supply view looks, starting with the current week. */
export const SUPPLY_WEEKS = 8;
/** As many farms harvesting the same crop in one week is flagged as a possible glut. */
export const CLASH_FARMS = 3;

interface SupplyPlanting {
  id: number;
  farmer: { id: number; name: string };
  cropType: { id: number; name: string };
  harvestStart: string;
  harvestEnd: string;
  expectedYield: number | null;
}

/**
 * Expected harvest per crop per week (Monday to Sunday), from plantings
 * still to be harvested. A planting's expected yield is spread evenly over
 * the days left in its harvest window, from today on; plantings without an
 * expected yield still count toward how many farms harvest that week.
 */
export function expectedSupply<P extends SupplyPlanting>(plantings: P[], today: string, weekCount: number) {
  const first = weekStart(today);
  const weeks = Array.from({ length: weekCount }, (_, i) => addDays(first, i * 7));
  const lastDay = addDays(first, weekCount * 7 - 1);

  const crops = new Map<number, { cropType: P["cropType"]; weekly: { kg: number; farms: Set<number> }[]; plantings: P[] }>();
  let withoutYield = 0;

  for (const p of plantings) {
    const from = p.harvestStart > today ? p.harvestStart : today;
    if (p.harvestEnd < from || from > lastDay) continue;
    const perDay = p.expectedYield !== null ? p.expectedYield / (daysBetween(from, p.harvestEnd) + 1) : 0;
    if (p.expectedYield === null) withoutYield++;

    let crop = crops.get(p.cropType.id);
    if (!crop) {
      crop = { cropType: p.cropType, weekly: weeks.map(() => ({ kg: 0, farms: new Set<number>() })), plantings: [] };
      crops.set(p.cropType.id, crop);
    }
    crop.plantings.push(p);

    weeks.forEach((ws, i) => {
      const we = addDays(ws, 6);
      const start = from > ws ? from : ws;
      const end = p.harvestEnd < we ? p.harvestEnd : we;
      const days = daysBetween(start, end) + 1;
      if (days <= 0) return;
      crop.weekly[i].kg += perDay * days;
      crop.weekly[i].farms.add(p.farmer.id);
    });
  }

  const round = (n: number) => Math.round(n * 10) / 10;
  const result = [...crops.values()].map((c) => {
    const weekly = c.weekly.map((w) => ({ kg: round(w.kg), farms: w.farms.size, clash: w.farms.size >= CLASH_FARMS }));
    return { cropType: c.cropType, weekly, totalKg: round(c.weekly.reduce((s, w) => s + w.kg, 0)), plantings: c.plantings };
  });
  result.sort((a, b) => b.totalKg - a.totalKg || a.cropType.name.localeCompare(b.cropType.name));

  return { weeks, crops: result, withoutYield, clashFarms: CLASH_FARMS };
}

// --- Harvest board (storefront home page) ------------------------------------

export interface HarvestBoardRow {
  crop: string;
  farms: number;
  kg: number;
}

/**
 * This week's expected harvest by crop, for the public home page: how many
 * farms and roughly how many kilograms, never which farms. Next week lists
 * the crops that only start then. Built on the same week split as the staff
 * supply view (Monday to Sunday, Philippine dates).
 */
export function harvestBoard<P extends SupplyPlanting>(plantings: P[], today: string) {
  const { crops } = expectedSupply(plantings, today, 2);
  const thisWeek: HarvestBoardRow[] = crops
    .filter((c) => c.weekly[0].farms > 0)
    .map((c) => ({ crop: c.cropType.name, farms: c.weekly[0].farms, kg: c.weekly[0].kg }))
    .sort((a, b) => b.kg - a.kg || b.farms - a.farms || a.crop.localeCompare(b.crop));
  const nextWeek = crops
    .filter((c) => c.weekly[0].farms === 0 && c.weekly[1].farms > 0)
    .map((c) => c.cropType.name)
    .sort((a, b) => a.localeCompare(b));
  return { thisWeek, nextWeek };
}
