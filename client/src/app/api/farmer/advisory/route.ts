import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { addDays, fromDateString, toDateString, todayPH } from "@/lib/planting";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/farmer/advisory — pest, weather and damage reports from all
 * members over the last 30 days, newest first. Shown with the crop type
 * (a staff-maintained name), never the farmer or their listing.
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
      },
      select: {
        id: true,
        type: true,
        note: true,
        observedOn: true,
        severity: true,
        pest: true,
        planting: { select: { cropType: { select: { name: true } } } },
      },
      orderBy: [{ observedOn: "desc" }, { id: "desc" }],
      take: 50,
    });

    return NextResponse.json(
      logs.map(({ planting, observedOn, ...log }) => ({
        ...log,
        observedOn: toDateString(observedOn),
        cropType: planting.cropType.name,
      })),
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch advisory" }, { status: 500 });
  }
}
