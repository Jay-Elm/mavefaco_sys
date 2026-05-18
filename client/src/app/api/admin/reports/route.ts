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

    const [orders, orderItems, users, products] = await Promise.all([
      prisma.order.findMany({
        select: { id: true, totalAmount: true, status: true, createdAt: true },
      }),
      prisma.orderItem.findMany({
        select: {
          quantity: true,
          price: true,
          order: { select: { status: true } },
          product: {
            select: {
              id: true,
              name: true,
              farmerId: true,
              farmer: { select: { id: true, name: true, email: true } },
              category: { select: { name: true } },
            },
          },
        },
      }),
      prisma.user.findMany({
        select: { id: true, role: true, name: true, email: true },
      }),
      prisma.product.findMany({
        select: { id: true, approved: true, farmerId: true },
      }),
    ]);

    // Summary
    const deliveredRevenue = orders
      .filter((o) => o.status === "delivered")
      .reduce((s, o) => s + o.totalAmount, 0);

    const summary = {
      totalRevenue: deliveredRevenue,
      totalOrders: orders.length,
      totalUsers: users.length,
      totalProducts: products.length,
      approvedProducts: products.filter((p) => p.approved).length,
    };

    // Orders by status
    const statusMap = new Map<string, number>();
    for (const o of orders) {
      statusMap.set(o.status, (statusMap.get(o.status) ?? 0) + 1);
    }
    const ordersByStatus = Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    // Sales by month
    const monthMap = new Map<string, { orders: number; revenue: number }>();
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 7);
      const entry = monthMap.get(key) ?? { orders: 0, revenue: 0 };
      entry.orders += 1;
      if (o.status === "delivered") entry.revenue += o.totalAmount;
      monthMap.set(key, entry);
    }
    const salesByMonth = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));

    // Users by role
    const roleMap = new Map<string, number>();
    for (const u of users) {
      roleMap.set(u.role, (roleMap.get(u.role) ?? 0) + 1);
    }
    const usersByRole = Array.from(roleMap.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);

    // Top products by units sold
    type ProdEntry = { name: string; category: string; farmer: string; unitsSold: number; revenue: number };
    const productMap = new Map<number, ProdEntry>();
    for (const item of orderItems) {
      const id = item.product.id;
      const entry = productMap.get(id) ?? {
        name: item.product.name,
        category: item.product.category.name,
        farmer: item.product.farmer.name,
        unitsSold: 0,
        revenue: 0,
      };
      entry.unitsSold += item.quantity;
      if (item.order.status === "delivered") {
        entry.revenue += item.price * item.quantity;
      }
      productMap.set(id, entry);
    }
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 10);

    // Sales by category
    type CatEntry = { unitsSold: number; revenue: number };
    const catMap = new Map<string, CatEntry>();
    for (const item of orderItems) {
      const cat = item.product.category.name;
      const entry = catMap.get(cat) ?? { unitsSold: 0, revenue: 0 };
      entry.unitsSold += item.quantity;
      if (item.order.status === "delivered") {
        entry.revenue += item.price * item.quantity;
      }
      catMap.set(cat, entry);
    }
    const salesByCategory = Array.from(catMap.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    // Farmer performance
    type FarmerEntry = { id: number; name: string; email: string; unitsSold: number; revenue: number };
    const farmerProductCounts = new Map<number, number>();
    for (const p of products) {
      farmerProductCounts.set(p.farmerId, (farmerProductCounts.get(p.farmerId) ?? 0) + 1);
    }
    const farmerMap = new Map<number, FarmerEntry>();
    for (const item of orderItems) {
      const { id, name, email } = item.product.farmer;
      const entry = farmerMap.get(id) ?? { id, name, email, unitsSold: 0, revenue: 0 };
      entry.unitsSold += item.quantity;
      if (item.order.status === "delivered") {
        entry.revenue += item.price * item.quantity;
      }
      farmerMap.set(id, entry);
    }
    for (const u of users.filter((u) => u.role === "farmer")) {
      if (!farmerMap.has(u.id)) {
        farmerMap.set(u.id, { id: u.id, name: u.name, email: u.email, unitsSold: 0, revenue: 0 });
      }
    }
    const farmerPerformance = Array.from(farmerMap.values())
      .map((f) => ({ ...f, productCount: farmerProductCounts.get(f.id) ?? 0 }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      summary,
      ordersByStatus,
      salesByMonth,
      usersByRole,
      topProducts,
      salesByCategory,
      farmerPerformance,
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate reports" }, { status: 500 });
  }
}
