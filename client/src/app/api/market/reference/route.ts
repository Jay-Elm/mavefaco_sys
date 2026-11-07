import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { loadPriceReference } from "@/lib/marketQuery";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/market/reference?cropTypeId= — the latest PSA farmgate price for
 * a crop in Albay and in Bicol, shown beside the price box when a farmer
 * sets a listing's price.
 */
export async function GET(req: NextRequest) {
  const user = await getActiveAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!authorize(user, [ROLES.ADMIN, ROLES.MANAGER, ROLES.FARMER]))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = Number(req.nextUrl.searchParams.get("cropTypeId"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "cropTypeId is required" }, { status: 400 });
  const ref = await loadPriceReference(id);
  if (!ref) return NextResponse.json({ error: "Crop not found" }, { status: 404 });
  return NextResponse.json(ref);
}
