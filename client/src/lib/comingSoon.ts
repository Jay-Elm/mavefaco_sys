import { prisma } from "@/lib/prisma";
import { fromDateString, toDateString, todayPH } from "@/lib/planting";

export type ComingSoon = { harvestStart: string; harvestEnd: string } | null;

/**
 * Adds `comingSoon` to storefront products: for a listing that's out of
 * stock, the harvest window of the earliest growing planting its farmer has
 * linked to it, as long as that window hasn't already closed. In-stock
 * listings, and those with nothing growing, get null.
 */
export async function withComingSoon<T extends { id: number; stock: number }>(products: T[]): Promise<(T & { comingSoon: ComingSoon })[]> {
  const outOfStock = products.filter((p) => p.stock <= 0).map((p) => p.id);
  const windows = new Map<number, ComingSoon>();

  if (outOfStock.length > 0) {
    const plantings = await prisma.planting.findMany({
      where: { productId: { in: outOfStock }, status: "growing", harvestEnd: { gte: fromDateString(todayPH()) } },
      select: { productId: true, harvestStart: true, harvestEnd: true },
      orderBy: [{ harvestStart: "asc" }, { id: "asc" }],
    });
    for (const p of plantings) {
      if (p.productId !== null && !windows.has(p.productId)) {
        windows.set(p.productId, { harvestStart: toDateString(p.harvestStart), harvestEnd: toDateString(p.harvestEnd) });
      }
    }
  }

  return products.map((p) => ({ ...p, comingSoon: windows.get(p.id) ?? null }));
}
