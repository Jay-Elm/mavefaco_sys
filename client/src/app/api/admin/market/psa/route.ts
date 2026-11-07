import { NextRequest, NextResponse } from "next/server";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { rateLimit } from "@/lib/rateLimit";
import { prisma } from "@/lib/prisma";
import { syncPsaMarket } from "@/lib/psa";

export const maxDuration = 60;

/**
 * POST /api/admin/market/psa — staff fetch the latest PSA figures now,
 * rather than waiting for the weekly job (e.g. right after deploying).
 */
export async function POST(req: NextRequest) {
  const user = await getActiveAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!authorize(user, [ROLES.ADMIN, ROLES.MANAGER]))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { allowed, retryAfterSeconds } = await rateLimit(`psa-sync:${user.id}`, 3, 60 * 60 * 1000);
  if (!allowed)
    return NextResponse.json(
      { error: "PSA figures were just updated. Try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );

  const result = await syncPsaMarket();
  await prisma.auditLog.create({ data: { action: "SYNC_PSA_MARKET", entityType: "MARKET", entityId: 0, userId: user.id } });
  if (result.prices + result.production === 0 && result.errors.length)
    return NextResponse.json({ error: `Couldn't get figures from PSA OpenSTAT: ${result.errors[0]}. Try again later.`, ...result }, { status: 502 });
  return NextResponse.json(result);
}
