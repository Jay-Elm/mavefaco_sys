import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "farmer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const products = await prisma.product.findMany({
      where: { farmerId: actor.id },
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
        _count: { select: { cropLogs: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(products);
  } catch {
    return NextResponse.json({ error: "Failed to fetch crops" }, { status: 500 });
  }
}
