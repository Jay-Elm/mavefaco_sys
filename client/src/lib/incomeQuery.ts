import { prisma } from "@/lib/prisma";
import { isKg } from "@/lib/market";
import { AREAS, type Area } from "@/lib/psa";
import { incomeEstimate, type IncomeEstimate, type OwnPriceSource, type PsaPriceSource } from "@/lib/income";

type PlantingForIncome = {
  farmerId: number;
  cropTypeId: number;
  productId: number | null;
  status: string;
  expectedYield: number | null;
  actualYield: number | null;
};

/**
 * Each planting with its income estimate (see lib/income.ts). The prices are
 * looked up once for all the plantings given, which must belong to one farmer.
 */
export async function withIncome<P extends PlantingForIncome>(plantings: P[]): Promise<(P & { income: IncomeEstimate | null })[]> {
  if (plantings.length === 0) return [];
  const farmerId = plantings[0].farmerId;
  const cropIds = [...new Set(plantings.map((p) => p.cropTypeId))];
  const linkedIds = [...new Set(plantings.flatMap((p) => (p.productId != null ? [p.productId] : [])))];

  const [listings, prices] = await Promise.all([
    prisma.product.findMany({
      where: {
        farmerId,
        archivedAt: null,
        OR: [{ cropTypeId: { in: cropIds } }, ...(linkedIds.length ? [{ id: { in: linkedIds } }] : [])],
      },
      select: { id: true, name: true, unit: true, price: true, cropTypeId: true, updatedAt: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    }),
    prisma.marketPrice.findMany({
      where: { cropTypeId: { in: cropIds }, area: { in: [...AREAS] } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { cropTypeId: true, area: true, year: true, month: true, pricePerKg: true },
    }),
  ]);

  const kgListings = listings.filter((l) => isKg(l.unit) && Number(l.price) > 0);
  const toSource = (l: (typeof kgListings)[number]): OwnPriceSource => ({
    listing: { id: l.id, name: l.name },
    pricePerKg: Number(l.price),
  });
  const byId = new Map(kgListings.map((l) => [l.id, l]));
  // Newest first, so the first listing seen for a crop is its newest.
  const newestByCrop = new Map<number, (typeof kgListings)[number]>();
  for (const l of kgListings) if (l.cropTypeId != null && !newestByCrop.has(l.cropTypeId)) newestByCrop.set(l.cropTypeId, l);

  // Latest price per crop per area (rows come newest first); Albay before Bicol.
  const latest = new Map<string, PsaPriceSource>();
  for (const r of prices) {
    const key = `${r.cropTypeId}:${r.area}`;
    if (!latest.has(key))
      latest.set(key, {
        area: r.area as Area,
        month: `${r.year}-${String(r.month).padStart(2, "0")}`,
        pricePerKg: Math.round(r.pricePerKg * 100) / 100,
      });
  }
  const psaFor = (cropId: number) => latest.get(`${cropId}:albay`) ?? latest.get(`${cropId}:bicol`) ?? null;

  return plantings.map((p) => {
    // A linked listing tagged with another crop says nothing about this one's price.
    const linked = p.productId != null ? byId.get(p.productId) : undefined;
    const linkedFits = linked && (linked.cropTypeId == null || linked.cropTypeId === p.cropTypeId) ? linked : undefined;
    const own = linkedFits ?? newestByCrop.get(p.cropTypeId);
    return { ...p, income: incomeEstimate(p, own ? toSource(own) : null, psaFor(p.cropTypeId)) };
  });
}
