import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { addDays, fromDateString, toDateString, todayPH } from "@/lib/planting";
import { groupAdvisory } from "@/lib/advisory";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/farmer/advisory — members' pest, weather and damage reports from
 * the last 30 days, grouped by crop and problem with how many farms saw it.
 * Named by crop type only: never the farmer or their listing.
 */
export async function GET(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "farmer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const logs = await prisma.cropLog.findMany({
      where: {
        type: { in: ["pest_disease", "weather_impact", "damage"] },
        observedOn: { gte: fromDateString(addDays(todayPH(), -30)) },
        planting: { farmer: { deletedAt: null } },
      },
      select: {
        id: true,
        type: true,
        note: true,
        observedOn: true,
        severity: true,
        pest: true,
        planting: { select: { farmerId: true, cropType: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json(
      groupAdvisory(
        logs.map(({ planting, observedOn, ...log }) => ({
          ...log,
          observedOn: toDateString(observedOn),
          farmerId: planting.farmerId,
          cropType: planting.cropType,
        })),
      ),
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch advisory" }, { status: 500 });
  }
}
