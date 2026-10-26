import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { fromDateString, harvestWindow, plantingInclude, serializePlanting, todayPH } from "@/lib/planting";
import { NextRequest, NextResponse } from "next/server";
import { plantingCreateSchema } from "@/validators/crop";

/** GET /api/farmer/plantings — the farmer's plantings, newest first. */
export async function GET(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "farmer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const plantings = await prisma.planting.findMany({
      where: { farmerId: actor.id },
      include: {
        ...plantingInclude,
        _count: { select: { logs: true } },
        // The latest serious problem, for "Needs attention".
        logs: {
          where: { severity: "high" },
          orderBy: [{ observedOn: "desc" }, { id: "desc" }],
          take: 1,
          select: { id: true, type: true, pest: true, note: true, observedOn: true },
        },
      },
      orderBy: [{ plantedOn: "desc" }, { id: "desc" }],
    });
    const today = todayPH();
    return NextResponse.json(
      plantings.map(({ logs, ...p }) => ({
        ...serializePlanting(p, today),
        latestHighSeverity: logs[0] ? { ...logs[0], observedOn: logs[0].observedOn.toISOString().slice(0, 10) } : null,
      })),
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch plantings" }, { status: 500 });
  }
}

/** POST /api/farmer/plantings — record a planting. The harvest window comes from the crop type. */
export async function POST(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "farmer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const parsed = plantingCreateSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { cropTypeId, plantedOn, areaSqm, expectedYield, productId } = parsed.data;

    const cropType = await prisma.cropType.findUnique({ where: { id: cropTypeId } });
    if (!cropType) return NextResponse.json({ error: "Choose a crop from the list" }, { status: 400 });

    if (productId != null) {
      const product = await prisma.product.findFirst({ where: { id: productId, farmerId: actor.id, archivedAt: null } });
      if (!product) return NextResponse.json({ error: "Choose one of your own listings" }, { status: 400 });
    }

    const { harvestStart, harvestEnd } = harvestWindow(cropType, plantedOn);
    const planting = await prisma.planting.create({
      data: {
        farmerId: actor.id,
        cropTypeId,
        productId: productId ?? null,
        plantedOn: fromDateString(plantedOn),
        harvestStart: fromDateString(harvestStart),
        harvestEnd: fromDateString(harvestEnd),
        areaSqm: areaSqm ?? null,
        expectedYield: expectedYield ?? null,
      },
      include: plantingInclude,
    });
    return NextResponse.json(serializePlanting(planting), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to record planting" }, { status: 500 });
  }
}
