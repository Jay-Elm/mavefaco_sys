import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/orders/options?farmerId= — what checkout can offer for this
 * farmer's products: GCash only when the farmer has set it up.
 */
export async function GET(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const farmerId = Number(req.nextUrl.searchParams.get("farmerId"));
  if (!Number.isInteger(farmerId) || farmerId <= 0)
    return NextResponse.json({ error: "farmerId is required" }, { status: 400 });

  const farmer = await prisma.user.findFirst({
    where: { id: farmerId, role: "farmer", deletedAt: null },
    select: { gcashName: true, gcashNumber: true },
  });
  return NextResponse.json({ gcash: Boolean(farmer?.gcashName && farmer.gcashNumber) });
}
