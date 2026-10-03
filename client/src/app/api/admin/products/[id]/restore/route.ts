import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/products/[id]/restore — undo an archive (see the
 * product DELETE route). The product goes back to every live listing with
 * the approval status it had when it was archived.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(actor, [ROLES.ADMIN, ROLES.MANAGER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await context.params;
    const productId = Number(id);
    if (isNaN(productId)) return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });

    // Conditional on still being archived, so a double-click can't log two restores.
    const { count } = await prisma.product.updateMany({
      where: { id: productId, archivedAt: { not: null } },
      data: { archivedAt: null },
    });
    if (count === 0) return NextResponse.json({ error: "Archived product not found" }, { status: 404 });

    await prisma.auditLog.create({
      data: { action: "RESTORE_PRODUCT", entityType: "PRODUCT", entityId: productId, userId: actor.id },
    });

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: {
        category: true,
        farmer: { select: { id: true, name: true, email: true } },
        _count: { select: { orderItems: true } },
      },
    });
    return NextResponse.json({ ...product, price: Number(product.price) });
  } catch {
    return NextResponse.json({ error: "Failed to restore product" }, { status: 500 });
  }
}
