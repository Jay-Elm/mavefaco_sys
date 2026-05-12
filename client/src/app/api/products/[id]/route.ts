import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const product = await prisma.product.findUnique({
      where: { id: Number(id) },
      include: {
        category: true,
        farmer: { select: { id: true, name: true, email: true } },
      },
    });

    if (!product)
      return NextResponse.json({ error: "Product not found" }, { status: 404 });

    if (!product.approved) {
      const actor = await getActiveAuthUser(req);
      const isAdminOrManager = actor && (actor.role === "admin" || actor.role === "manager");
      const isOwner = actor && actor.id === product.farmerId;
      if (!isAdminOrManager && !isOwner)
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getActiveAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(user, [ROLES.ADMIN, ROLES.MANAGER, ROLES.FARMER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await context.params;
    const productId = Number(id);
    if (isNaN(productId))
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product)
      return NextResponse.json({ error: "Product not found" }, { status: 404 });

    if (user.role === ROLES.FARMER && product.farmerId !== user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { name, description, price, stock, imageUrl, categoryId } = body;

    // If a farmer edits any content field that actually changed, revoke approval for re-review
    const contentChanged =
      user.role === ROLES.FARMER &&
      product.approved &&
      (
        (name !== undefined && name !== product.name) ||
        (description !== undefined && description !== product.description) ||
        (price !== undefined && Number(price) !== product.price) ||
        (categoryId !== undefined && Number(categoryId) !== product.categoryId) ||
        (imageUrl !== undefined && (imageUrl || null) !== product.imageUrl)
      );

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: Number(price) }),
        ...(stock !== undefined && { stock: Number(stock) }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(categoryId !== undefined && { categoryId: Number(categoryId) }),
        ...(contentChanged && { approved: false }),
      },
      include: { category: true, farmer: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getActiveAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(user, [ROLES.ADMIN, ROLES.MANAGER, ROLES.FARMER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await context.params;
    const productId = Number(id);
    if (isNaN(productId))
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product)
      return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // Farmers can only delete their own products
    if (user.role === ROLES.FARMER && product.farmerId !== user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const activeOrderItem = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: { status: { in: ["pending", "confirmed", "shipped"] } },
      },
    });
    if (activeOrderItem)
      return NextResponse.json(
        { error: "Cannot delete: this product has active orders. Wait for them to complete first." },
        { status: 409 },
      );

    await prisma.product.delete({ where: { id: productId } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE_PRODUCT",
        entityType: "PRODUCT",
        entityId: productId,
        userId: user.id,
      },
    });

    return NextResponse.json({ message: "Product deleted" });
  } catch {
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
