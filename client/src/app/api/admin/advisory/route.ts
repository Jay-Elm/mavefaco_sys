import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { recentAdvisory } from "@/lib/advisoryQuery";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/advisory — the same grouped advisory farmers see, for
 * staff: what members reported in the last 30 days, by crop and kind of
 * problem, with how many farms. No farm is named here either.
 */
export async function GET(req: NextRequest) {
  const user = await getActiveAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!authorize(user, [ROLES.ADMIN, ROLES.MANAGER]))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    return NextResponse.json(await recentAdvisory());
  } catch {
    return NextResponse.json({ error: "Failed to fetch advisory" }, { status: 500 });
  }
}
