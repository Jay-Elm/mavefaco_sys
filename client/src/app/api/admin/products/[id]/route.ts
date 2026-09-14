import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { adminProductUpdateSchema } from "@/validators/product";

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

    const parsed = adminProductUpdateSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { approved, name, description, price, stock, categoryId, imageUrl } = parsed.data;

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(approved !== undefined && { approved }),
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

    return NextResponse.json({ ...updated, price: Number(updated.price) });
  } catch {
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}
