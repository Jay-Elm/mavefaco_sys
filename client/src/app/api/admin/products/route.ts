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

    // ?archived=1 lists archived products instead, for the restore view.
    const archived = new URL(req.url).searchParams.get("archived") === "1";

    const products = await prisma.product.findMany({
      where: { archivedAt: archived ? { not: null } : null },
      include: {
        category: true,
        farmer: { select: { id: true, name: true, email: true } },
        _count: { select: { orderItems: true } },
      },
      orderBy: archived ? { archivedAt: "desc" } : { createdAt: "desc" },
    });

    return NextResponse.json(products.map((p) => ({ ...p, price: Number(p.price) })));
  } catch {
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
