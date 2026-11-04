import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { recentAdvisory } from "@/lib/advisoryQuery";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/farmer/advisory — members' pest, weather and damage reports from
 * the last 30 days, grouped by crop and kind of problem with how many farms
 * saw it. Named by crop type only: never the farmer or their listing.
 */
export async function GET(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "farmer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    return NextResponse.json(await recentAdvisory());
  } catch {
    return NextResponse.json({ error: "Failed to fetch advisory" }, { status: 500 });
  }
}
