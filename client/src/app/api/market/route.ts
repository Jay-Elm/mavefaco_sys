import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { loadMarket } from "@/lib/marketQuery";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/market — market signals per crop (demand, planned supply,
 * selling prices, alerts, crops worth planting). Staff and farmers; totals
 * only, no farm or customer named.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getActiveAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(user, [ROLES.ADMIN, ROLES.MANAGER, ROLES.FARMER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json(await loadMarket());
  } catch (err) {
    console.error("GET /api/market error:", err);
    return NextResponse.json({ error: "Failed to load market signals" }, { status: 500 });
  }
}
