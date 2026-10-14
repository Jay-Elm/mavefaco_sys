import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const user = await getActiveAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(user, [ROLES.ADMIN, ROLES.MANAGER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [userCount, approvedProductCount, pendingProductCount, suspendedProductCount, orderCount, revenueAgg, recentOrders] =
      await Promise.all([
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.product.count({ where: { approved: true, archivedAt: null } }),
        // Pending = waiting for review. A suspended listing is unapproved too,
        // but it waits on its farmer, not on staff, so it's counted apart.
        prisma.product.count({ where: { approved: false, archivedAt: null, suspendedAt: null } }),
        prisma.product.count({ where: { archivedAt: null, suspendedAt: { not: null } } }),
        prisma.order.count(),
        prisma.order.aggregate({ _sum: { totalAmount: true }, where: { status: 'delivered' } }),
        prisma.order.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: { customer: { select: { name: true, email: true } } },
        }),
      ]);

    return NextResponse.json({
      userCount,
      approvedProductCount,
      pendingProductCount,
      suspendedProductCount,
      orderCount,
      totalRevenue: Number(revenueAgg._sum.totalAmount ?? 0),
      recentOrders: recentOrders.map((o) => ({ ...o, totalAmount: Number(o.totalAmount) })),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
