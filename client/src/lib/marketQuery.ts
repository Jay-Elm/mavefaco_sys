import { prisma } from "@/lib/prisma";
import { expectedSupply, toDateString, todayPH, addDays } from "@/lib/planting";
import { DEMAND_WEEKS, PRICE_MONTHS, marketAlerts, marketByCrop, suggestedCrops, type SaleLine } from "@/lib/market";
import { AREAS, PSA_CREDIT, type Area } from "@/lib/psa";

/**
 * Everything the Market pages show, computed from the database. Totals
 * only: no farm or customer is named, so farmers can see it too.
 */
export async function loadMarket(now: Date = new Date()) {
  const today = todayPH(now);

  const [crops, items, plantings] = await Promise.all([
    prisma.cropType.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, daysToHarvestMin: true, daysToHarvestMax: true, source: true },
    }),
    prisma.orderItem.findMany({
      where: {
        product: { cropTypeId: { not: null } },
        order: { status: { not: "cancelled" }, createdAt: { gte: new Date(`${addDays(today, -31 * (PRICE_MONTHS + 1))}T00:00:00+08:00`) } },
      },
      select: {
        quantity: true,
        price: true,
        product: { select: { cropTypeId: true, unit: true } },
        order: { select: { createdAt: true } },
      },
    }),
    prisma.planting.findMany({
      where: { status: "growing", farmer: { deletedAt: null } },
      select: {
        id: true,
        harvestStart: true,
        harvestEnd: true,
        expectedYield: true,
        cropType: { select: { id: true, name: true } },
        farmer: { select: { id: true, name: true } },
      },
    }),
  ]);

  const sales: SaleLine[] = items.map((i) => ({
    cropTypeId: i.product.cropTypeId!,
    orderedOn: todayPH(i.order.createdAt),
    quantity: i.quantity,
    unit: i.product.unit,
    price: Number(i.price),
  }));

  const upcoming = plantings
    .map((p) => ({ ...p, harvestStart: toDateString(p.harvestStart), harvestEnd: toDateString(p.harvestEnd) }))
    .filter((p) => p.harvestEnd >= today);
  const outlook = expectedSupply(upcoming, today, DEMAND_WEEKS);
  const supply = outlook.crops.map((c) => ({
    cropTypeId: c.cropType.id,
    kg: c.totalKg,
    farms: new Set(c.plantings.map((p) => p.farmer.id)).size,
  }));

  const rows = marketByCrop(crops, sales, supply, today);
  const psa = await loadPsa(today);
  return {
    today,
    demandWeeks: DEMAND_WEEKS,
    rows: rows.map((r) => ({ ...r, psa: psa.byCrop.get(r.crop.id) ?? emptyPsa() })),
    psa: psa.summary,
    alerts: marketAlerts(rows),
    suggestions: suggestedCrops(rows).map((r) => r.crop.id),
    // Listings not yet tied to a crop don't count toward any crop's demand.
    unlinkedListings: await prisma.product.count({ where: { cropTypeId: null, archivedAt: null } }),
  };
}

type PsaPoint = { month: string; pricePerKg: number };
type PsaQuarter = { year: number; quarter: number; tonnes: number };
export interface CropPsa {
  prices: Record<Area, PsaPoint[]>;
  latest: Record<Area, PsaPoint | null>;
  production: Record<Area, PsaQuarter[]>;
}
const emptyPsa = (): CropPsa => ({
  prices: { albay: [], bicol: [] },
  latest: { albay: null, bicol: null },
  production: { albay: [], bicol: [] },
});
const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

/**
 * PSA farmgate prices (last PRICE_MONTHS months, plus each area's latest
 * figure however old) and the last four quarters of production, per crop.
 */
async function loadPsa(today: string) {
  const [y, m] = today.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - PRICE_MONTHS, 1));
  const fromKey = from.getUTCFullYear() * 100 + from.getUTCMonth() + 1;

  const [prices, production, fetched] = await Promise.all([
    prisma.marketPrice.findMany({ orderBy: [{ year: "asc" }, { month: "asc" }] }),
    prisma.marketProduction.findMany({ orderBy: [{ year: "asc" }, { quarter: "asc" }] }),
    prisma.marketPrice.aggregate({ _max: { fetchedAt: true } }),
  ]);

  const byCrop = new Map<number, CropPsa>();
  const get = (id: number) => byCrop.get(id) ?? (byCrop.set(id, emptyPsa()), byCrop.get(id)!);
  let latestMonth: string | null = null;

  for (const p of prices) {
    const area = p.area as Area;
    if (!AREAS.includes(area)) continue;
    const point = { month: ym(p.year, p.month), pricePerKg: Math.round(p.pricePerKg * 100) / 100 };
    const c = get(p.cropTypeId);
    c.latest[area] = point; // ascending, so the last one wins
    if (p.year * 100 + p.month >= fromKey) c.prices[area].push(point);
    if (!latestMonth || point.month > latestMonth) latestMonth = point.month;
  }
  for (const q of production) {
    const area = q.area as Area;
    if (!AREAS.includes(area)) continue;
    const list = get(q.cropTypeId).production[area];
    list.push({ year: q.year, quarter: q.quarter, tonnes: Math.round(q.tonnes * 10) / 10 });
    if (list.length > 4) list.shift();
  }

  return {
    byCrop,
    summary: { source: PSA_CREDIT, latestMonth, updatedAt: fetched._max.fetchedAt?.toISOString() ?? null },
  };
}

/** One crop's price references, for the Add/Edit Product form. */
export async function loadPriceReference(cropTypeId: number, now: Date = new Date()) {
  const crop = await prisma.cropType.findUnique({ where: { id: cropTypeId }, select: { id: true, name: true } });
  if (!crop) return null;
  const { byCrop, summary } = await loadPsa(todayPH(now));
  const psa = byCrop.get(cropTypeId) ?? emptyPsa();
  return { crop, albay: psa.latest.albay, bicol: psa.latest.bicol, source: summary.source };
}
