import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "farmer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const productId = Number(id);
  if (isNaN(productId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId, farmerId: actor.id },
      select: {
        id: true,
        name: true,
        stock: true,
        approved: true,
        plantingDate: true,
        expectedHarvestDate: true,
        growthStage: true,
        readyForHarvest: true,
        category: { select: { name: true } },
        cropLogs: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "Failed to fetch crop" }, { status: 500 });
  }
}

const VALID_STAGES = ["seedling", "vegetative", "flowering", "fruiting", "harvest-ready", "harvested"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "farmer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const productId = Number(id);
  if (isNaN(productId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const existing = await prisma.product.findUnique({ where: { id: productId, farmerId: actor.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await req.json();
    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(body.plantingDate !== undefined && {
          plantingDate: body.plantingDate ? new Date(body.plantingDate) : null,
        }),
        ...(body.expectedHarvestDate !== undefined && {
          expectedHarvestDate: body.expectedHarvestDate ? new Date(body.expectedHarvestDate) : null,
        }),
        ...(body.growthStage !== undefined && {
          growthStage: VALID_STAGES.includes(body.growthStage) ? body.growthStage : null,
        }),
        ...(body.readyForHarvest !== undefined && {
          readyForHarvest: Boolean(body.readyForHarvest),
        }),
      },
      select: {
        id: true,
        plantingDate: true,
        expectedHarvestDate: true,
        growthStage: true,
        readyForHarvest: true,
      },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update crop" }, { status: 500 });
  }
}
