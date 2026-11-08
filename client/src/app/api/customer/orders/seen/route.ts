import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/customer/orders/seen — the customer opened My Orders, so their
 * updated orders stop counting on the My Orders badge. Only orders with an
 * unseen update are written, so calling it again changes nothing.
 */
export async function POST(req: NextRequest) {
  const user = await getActiveAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!authorize(user, [ROLES.CUSTOMER])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { count } = await prisma.order.updateMany({
      where: { customerId: user.id, customerNotifiedAt: { gt: prisma.order.fields.customerSeenAt } },
      data: { customerSeenAt: new Date() },
    });
    return NextResponse.json({ seen: count });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
