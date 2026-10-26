import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { fromDateString, plantingInclude, serializePlanting, toDateString } from "@/lib/planting";
import { NextRequest, NextResponse } from "next/server";
import { harvestSchema } from "@/validators/crop";

/** Thrown inside the transaction to roll it back. */
class HarvestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * POST /api/farmer/plantings/[id]/harvest — record that a growing planting
 * was harvested and how much it yielded, optionally adding to the stock of
 * its linked listing in the same step. A stock-only change doesn't send the
 * listing back for review.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "farmer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  try {
    const planting = await prisma.planting.findFirst({ where: { id, farmerId: actor.id } });
    if (!planting) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = harvestSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { harvestedOn, actualYield, addToStock } = parsed.data;

    if (harvestedOn < toDateString(planting.plantedOn))
      return NextResponse.json({ error: "Harvest date can't be before the planting date" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      // Only once: a second submit (or another tab) finds it no longer growing.
      const { count } = await tx.planting.updateMany({
        where: { id, farmerId: actor.id, status: "growing" },
        data: { status: "harvested", harvestedOn: fromDateString(harvestedOn), actualYield: actualYield ?? null },
      });
      if (count === 0) throw new HarvestError("This planting isn't growing any more, please refresh", 409);

      if (addToStock) {
        const { productId } = await tx.planting.findUniqueOrThrow({ where: { id }, select: { productId: true } });
        if (productId === null) throw new HarvestError("Link a listing to add the harvest to its stock", 400);
        const stocked = await tx.product.updateMany({
          where: { id: productId, farmerId: actor.id, archivedAt: null },
          data: { stock: { increment: addToStock } },
        });
        if (stocked.count === 0) throw new HarvestError("The linked listing is no longer available", 409);
      }
    });

    const updated = await prisma.planting.findUniqueOrThrow({ where: { id }, include: plantingInclude });
    return NextResponse.json(serializePlanting(updated));
  } catch (error) {
    if (error instanceof HarvestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Failed to record harvest" }, { status: 500 });
  }
}
