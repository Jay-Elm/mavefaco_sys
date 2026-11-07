import { addDays } from "@/lib/planting";

/**
 * Market signals from the marketplace's own records: what customers bought
 * of each crop lately (demand), what member farms expect to harvest soon
 * (planned supply), what it sold for, and which crops look worth planting.
 *
 * These are guidance from one cooperative's sales, not market forecasts,
 * and mean little until real orders build up.
 */

/** Weeks of sales counted as recent demand (the supply outlook looks as far ahead). */
export const DEMAND_WEEKS = 8;
/** Less than this many kilos sold in DEMAND_WEEKS is too little to judge. */
export const MIN_DEMAND_KG = 5;
/** Planned supply below this share of recent demand: demand is above supply. */
export const SHORT_RATIO = 0.75;
/** Planned supply above this multiple of recent demand: possible oversupply. */
export const GLUT_RATIO = 1.5;
/** Last 4 weeks at least this multiple of the 4 before: demand is rising. */
export const RISING_RATIO = 1.5;
/** Months of selling prices shown. */
export const PRICE_MONTHS = 12;

export type Signal = "demand-above-supply" | "balanced" | "oversupply" | "no-recent-demand" | "other-units" | "not-enough-data";

export const SIGNAL_LABELS: Record<Signal, string> = {
  "demand-above-supply": "Demand above supply",
  balanced: "Balanced",
  oversupply: "Possible oversupply",
  "no-recent-demand": "Little recent demand",
  "other-units": "Sold by bundle or piece",
  "not-enough-data": "Not enough sales yet",
};

export interface SaleLine {
  cropTypeId: number;
  /** "YYYY-MM-DD", Philippine time. */
  orderedOn: string;
  quantity: number;
  unit: string;
  /** Price per unit when ordered. */
  price: number;
}

export interface CropInfo {
  id: number;
  name: string;
  daysToHarvestMin: number;
  daysToHarvestMax: number;
  source?: string | null;
}

/** A crop's planned harvest over the supply outlook (from expectedSupply()). */
export interface PlannedSupply {
  cropTypeId: number;
  kg: number;
  farms: number;
}

const isKg = (unit: string) => /^(kg|kgs|kilo|kilos|kilogram|kilograms)$/i.test(unit.trim());
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Kilos for kg sales; other units are kept apart, since they can't be compared with kilos. */
function tally(lines: SaleLine[]) {
  let kg = 0;
  const other: Record<string, number> = {};
  for (const l of lines) {
    if (isKg(l.unit)) kg += l.quantity;
    else other[l.unit] = (other[l.unit] ?? 0) + l.quantity;
  }
  return { kg: round2(kg), other };
}

/**
 * `soldInOtherUnits`: the crop sold lately, but by the bundle or piece, so its
 * demand can't be set against planned kilos.
 */
export function signalFor(demandKg: number, supplyKg: number, soldInOtherUnits = false): Signal {
  if (demandKg < MIN_DEMAND_KG) {
    if (soldInOtherUnits) return "other-units";
    return supplyKg > 0 ? "no-recent-demand" : "not-enough-data";
  }
  const ratio = supplyKg / demandKg;
  if (ratio < SHORT_RATIO) return "demand-above-supply";
  if (ratio > GLUT_RATIO) return "oversupply";
  return "balanced";
}

/**
 * Demand rising: the last 4 weeks sold at least RISING_RATIO times the 4
 * weeks before, in the same unit, and enough to matter. Works for any unit.
 */
function rising(recent: { kg: number; other: Record<string, number> }, prior: { kg: number; other: Record<string, number> }) {
  if (recent.kg >= MIN_DEMAND_KG / 2 && recent.kg >= RISING_RATIO * prior.kg && recent.kg > prior.kg) return true;
  return Object.entries(recent.other).some(([u, q]) => q >= 3 && q >= RISING_RATIO * (prior.other[u] ?? 0) && q > (prior.other[u] ?? 0));
}

/** Average price per kilo by month ("YYYY-MM"), for kilo sales, oldest first; months with no sales are left out. */
function monthlyPrices(lines: SaleLine[], today: string) {
  const months: string[] = [];
  const [y, m] = today.split("-").map(Number);
  for (let i = PRICE_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const sums = new Map<string, { kg: number; pesos: number }>();
  for (const l of lines) {
    if (!isKg(l.unit)) continue;
    const month = l.orderedOn.slice(0, 7);
    if (!months.includes(month)) continue;
    const s = sums.get(month) ?? { kg: 0, pesos: 0 };
    s.kg += l.quantity;
    s.pesos += l.quantity * l.price;
    sums.set(month, s);
  }
  return months
    .filter((mo) => sums.has(mo))
    .map((mo) => {
      const s = sums.get(mo)!;
      return { month: mo, pricePerKg: round2(s.pesos / s.kg), kg: round2(s.kg) };
    });
}

export interface CropMarket {
  crop: CropInfo;
  /** Kilos sold in the last DEMAND_WEEKS, and sales in other units. */
  demand: { kg: number; other: Record<string, number>; orders: number };
  /** Planned harvest over the next DEMAND_WEEKS. */
  supply: { kg: number; farms: number };
  signal: Signal;
  /** Last 4 weeks well above the 4 before. */
  risingDemand: boolean;
  /** Recent kilo demand minus planned kilos (positive: room for more). */
  gapKg: number;
  /** Average selling price per kilo over DEMAND_WEEKS, if any kilo sales. */
  pricePerKg: number | null;
  prices: { month: string; pricePerKg: number; kg: number }[];
  /** Harvest window if planted today, from the crop's DA growing time. */
  plantTodayHarvest: { from: string; to: string };
}

/**
 * Market signals per crop. `sales` should be order lines from orders that
 * weren't cancelled, over at least the last PRICE_MONTHS months.
 */
export function marketByCrop(crops: CropInfo[], sales: SaleLine[], supply: PlannedSupply[], today: string): CropMarket[] {
  const since = addDays(today, -DEMAND_WEEKS * 7 + 1);
  const mid = addDays(today, -4 * 7 + 1);

  return crops.map((crop) => {
    const lines = sales.filter((s) => s.cropTypeId === crop.id);
    const recentLines = lines.filter((s) => s.orderedOn >= since && s.orderedOn <= today);
    const demand = tally(recentLines);
    const planned = supply.find((s) => s.cropTypeId === crop.id) ?? { kg: 0, farms: 0 };
    const kgLines = recentLines.filter((l) => isKg(l.unit));
    const kgSold = kgLines.reduce((s, l) => s + l.quantity, 0);

    return {
      crop,
      demand: { ...demand, orders: recentLines.length },
      supply: { kg: round1(planned.kg), farms: planned.farms },
      signal: signalFor(demand.kg, planned.kg, Object.keys(demand.other).length > 0),
      risingDemand: rising(tally(recentLines.filter((l) => l.orderedOn >= mid)), tally(recentLines.filter((l) => l.orderedOn < mid))),
      gapKg: round1(demand.kg - planned.kg),
      pricePerKg: kgSold > 0 ? round2(kgLines.reduce((s, l) => s + l.quantity * l.price, 0) / kgSold) : null,
      prices: monthlyPrices(lines, today),
      plantTodayHarvest: { from: addDays(today, crop.daysToHarvestMin), to: addDays(today, crop.daysToHarvestMax) },
    };
  });
}

export interface MarketAlert {
  cropTypeId: number;
  crop: string;
  kind: "low-supply" | "high-demand";
  message: string;
}

/** In-site alerts: demand outrunning planned harvests, and demand climbing fast. */
export function marketAlerts(rows: CropMarket[]): MarketAlert[] {
  const alerts: MarketAlert[] = [];
  for (const r of rows) {
    if (r.signal === "demand-above-supply")
      alerts.push({
        cropTypeId: r.crop.id,
        crop: r.crop.name,
        kind: "low-supply",
        message: `Customers bought ${r.demand.kg} kg of ${r.crop.name} in the last ${DEMAND_WEEKS} weeks; members plan to harvest ${r.supply.kg} kg in the next ${DEMAND_WEEKS}.`,
      });
    if (r.risingDemand)
      alerts.push({
        cropTypeId: r.crop.id,
        crop: r.crop.name,
        kind: "high-demand",
        message: `${r.crop.name} sold much more in the last 4 weeks than in the 4 before.`,
      });
  }
  // Shortages first, then by size of the gap.
  const gap = (a: MarketAlert) => rows.find((r) => r.crop.id === a.cropTypeId)?.gapKg ?? 0;
  return alerts.sort((a, b) => (a.kind === b.kind ? gap(b) - gap(a) : a.kind === "low-supply" ? -1 : 1));
}

/**
 * Crops worth planting now: demand above planned supply, biggest gap first.
 * Each carries the harvest window a planting made today would have.
 */
export function suggestedCrops(rows: CropMarket[]): CropMarket[] {
  return rows.filter((r) => r.signal === "demand-above-supply").sort((a, b) => b.gapKg - a.gapKg);
}

