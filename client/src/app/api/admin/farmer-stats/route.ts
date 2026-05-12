import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(actor, [ROLES.ADMIN, ROLES.MANAGER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const farmers = await prisma.user.findMany({
      where: { role: "farmer" },
      select: {
        id: true,
        name: true,
        email: true,
        verified: true,
        suspended: true,
        products: {
          select: {
            id: true,
            approved: true,
            orderItems: {
              select: {
                quantity: true,
                price: true,
                order: { select: { status: true } },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const stats = farmers.map((farmer) => {
      const productCount = farmer.products.length;
      const approvedCount = farmer.products.filter((p) => p.approved).length;
      const pendingCount = productCount - approvedCount;
      const totalOrderItems = farmer.products.reduce(
        (sum, p) => sum + p.orderItems.length,
        0,
      );
      const totalRevenue = farmer.products.reduce(
        (sum, p) =>
          sum +
          p.orderItems
            .filter((oi) => oi.order.status === "delivered")
            .reduce((s, oi) => s + oi.price * oi.quantity, 0),
        0,
      );

      return {
        id: farmer.id,
        name: farmer.name,
        email: farmer.email,
        verified: farmer.verified,
        suspended: farmer.suspended,
        productCount,
        approvedCount,
        pendingCount,
        totalOrderItems,
        totalRevenue,
      };
    });

    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ error: "Failed to fetch farmer stats" }, { status: 500 });
  }
}
