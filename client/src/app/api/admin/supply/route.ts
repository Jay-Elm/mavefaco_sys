import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { expectedSupply, toDateString, todayPH, SUPPLY_WEEKS } from "@/lib/planting";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/supply — expected harvests over the coming weeks, by crop,
 * from farmers' growing plantings, plus the plantings whose harvest window
 * has passed without a harvest being recorded.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getActiveAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(user, [ROLES.ADMIN, ROLES.MANAGER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const today = todayPH();
    const plantings = await prisma.planting.findMany({
      where: { status: "growing", farmer: { deletedAt: null } },
      include: {
        cropType: { select: { id: true, name: true } },
        farmer: { select: { id: true, name: true } },
      },
      orderBy: [{ harvestStart: "asc" }, { id: "asc" }],
    });

    const rows = plantings.map((p) => ({
      id: p.id,
      farmer: p.farmer,
      cropType: p.cropType,
      plantedOn: toDateString(p.plantedOn),
      harvestStart: toDateString(p.harvestStart),
      harvestEnd: toDateString(p.harvestEnd),
      areaSqm: p.areaSqm,
      expectedYield: p.expectedYield,
    }));
    const upcoming = rows.filter((p) => p.harvestEnd >= today);
    const overdue = rows.filter((p) => p.harvestEnd < today);

    return NextResponse.json({
      today,
      ...expectedSupply(upcoming, today, SUPPLY_WEEKS),
      overdue,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch supply" }, { status: 500 });
  }
}
