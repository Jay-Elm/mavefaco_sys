import { prisma } from "@/lib/prisma";
import { expectedSupply, toDateString, todayPH, addDays } from "@/lib/planting";
import { DEMAND_WEEKS, PRICE_MONTHS, marketAlerts, marketByCrop, suggestedCrops, type SaleLine } from "@/lib/market";

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
  return {
    today,
    demandWeeks: DEMAND_WEEKS,
    rows,
    alerts: marketAlerts(rows),
    suggestions: suggestedCrops(rows).map((r) => r.crop.id),
    // Listings not yet tied to a crop don't count toward any crop's demand.
    unlinkedListings: await prisma.product.count({ where: { cropTypeId: null, archivedAt: null } }),
  };
}
