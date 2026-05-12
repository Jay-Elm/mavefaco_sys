import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

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

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const body = await req.json();
    const { approved, name, description, price, stock, categoryId, imageUrl } = body;

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(typeof approved === "boolean" && { approved }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(stock !== undefined && { stock }),
        ...(categoryId !== undefined && { categoryId }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
      },
    });

    const action = typeof approved === "boolean"
      ? (approved ? "APPROVE_PRODUCT" : "REJECT_PRODUCT")
      : "EDIT_PRODUCT";

    await prisma.auditLog.create({
      data: { action, entityType: "PRODUCT", entityId: productId, userId: actor.id },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}
