import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { ROLES } from "@/lib/roles";
import { fromDateString, todayPH } from "@/lib/planting";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/nav-badges — how many things on each sidebar page are waiting
 * on the caller, keyed by the page's path. The sidebars show these as a red
 * badge; each one clears when the thing is dealt with (read, accepted,
 * resubmitted...). Pages with nothing to act on are left out.
 */
export async function GET(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    if (actor.role === ROLES.FARMER) {
      const [unreadMessages, unreadNotices, pendingOrders, suspendedProducts, cropsToHarvest, me] = await Promise.all([
        prisma.message.count({ where: { receiverId: actor.id, read: false } }),
        prisma.notice.count({ where: { recipientId: actor.id, read: false } }),
        // New orders waiting for the farmer to accept or reject
        prisma.order.count({ where: { status: "pending", items: { some: { product: { farmerId: actor.id } } } } }),
        // Listings staff suspended, waiting to be fixed and resubmitted
        prisma.product.count({ where: { farmerId: actor.id, archivedAt: null, suspendedAt: { not: null } } }),
        // Growing plantings whose harvest window has opened (or closed): harvest
        // them, or record what happened
        prisma.planting.count({
          where: { farmerId: actor.id, status: "growing", harvestStart: { lte: fromDateString(todayPH()) } },
        }),
        prisma.user.findUnique({ where: { id: actor.id }, select: { verified: true, idImagePath: true } }),
      ]);
      return NextResponse.json({
        "/farmer/messages": unreadMessages + unreadNotices,
        "/farmer/orders": pendingOrders,
        "/farmer/products": suspendedProducts,
        "/farmer/crops": cropsToHarvest,
        // Not verified and no ID uploaded: they can't list products yet
        "/farmer/profile": me && !me.verified && !me.idImagePath ? 1 : 0,
      });
    }

    if (actor.role === ROLES.ADMIN || actor.role === ROLES.MANAGER) {
      const [pendingProducts, idsToVerify] = await Promise.all([
        // Listings waiting for review (a suspended one waits on its farmer instead)
        prisma.product.count({ where: { approved: false, archivedAt: null, suspendedAt: null } }),
        // Farmers who uploaded an ID that nobody has verified yet
        prisma.user.count({
          where: { role: ROLES.FARMER, verified: false, idImagePath: { not: null }, deletedAt: null },
        }),
      ]);
      return NextResponse.json({
        "/dashboard/products": pendingProducts,
        "/dashboard/users": idsToVerify,
      });
    }

    return NextResponse.json({});
  } catch {
    return NextResponse.json({ error: "Failed to fetch badges" }, { status: 500 });
  }
}
