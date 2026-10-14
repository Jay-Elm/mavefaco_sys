import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { adminProductUpdateSchema } from "@/validators/product";

/**
 * PATCH /api/admin/products/[id] — approve a pending listing. A suspended
 * listing can't be approved here: its farmer resubmits it by editing it,
 * which puts it back in the pending queue.
 */
export async function PATCH(
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

    const parsed = adminProductUpdateSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const product = await prisma.product.findUnique({ where: { id: productId, archivedAt: null } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (product.suspendedAt)
      return NextResponse.json(
        { error: "This listing is suspended. The farmer must edit and resubmit it before it can be approved." },
        { status: 409 },
      );

    // Conditional on it still being live and unsuspended, so a suspension
    // landing at the same moment isn't silently undone.
    const { count } = await prisma.product.updateMany({
      where: { id: productId, archivedAt: null, suspendedAt: null },
      data: { approved: true },
    });
    if (count === 0) return NextResponse.json({ error: "This listing changed, please refresh" }, { status: 409 });

    await prisma.auditLog.create({
      data: { action: "APPROVE_PRODUCT", entityType: "PRODUCT", entityId: productId, userId: actor.id },
    });

    const updated = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    return NextResponse.json({ ...updated, price: Number(updated.price) });
  } catch {
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}
