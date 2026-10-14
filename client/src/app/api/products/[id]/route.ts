import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { productUpdateSchema } from "@/validators/product";
import { removeListing } from "@/lib/productRemoval";

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

    if (!product || product.archivedAt)
      return NextResponse.json({ error: "Product not found" }, { status: 404 });

    if (!product.approved) {
      const actor = await getActiveAuthUser(req);
      const isAdminOrManager = actor && (actor.role === "admin" || actor.role === "manager");
      const isOwner = actor && actor.id === product.farmerId;
      if (!isAdminOrManager && !isOwner)
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ ...product, price: Number(product.price) });
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
    // Only the listing's farmer edits it. Staff approve or suspend instead.
    if (!authorize(user, [ROLES.FARMER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await context.params;
    const productId = Number(id);
    if (isNaN(productId))
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const product = await prisma.product.findUnique({ where: { id: productId, archivedAt: null } });
    if (!product)
      return NextResponse.json({ error: "Product not found" }, { status: 404 });

    if (product.farmerId !== user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = productUpdateSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { name, description, price, stock, unit, imageUrl, categoryId } = parsed.data;

    // Did anything customers see actually change? (Stock alone doesn't count.)
    const contentChanged =
      (name !== undefined && name !== product.name) ||
      (description !== undefined && description !== product.description) ||
      (price !== undefined && price !== Number(product.price)) ||
      (unit !== undefined && unit !== product.unit) ||
      (categoryId !== undefined && categoryId !== product.categoryId) ||
      (imageUrl !== undefined && (imageUrl || null) !== product.imageUrl);

    // An approved listing goes back for review; a suspended one is thereby
    // resubmitted: the suspension is lifted and it waits for review.
    const resubmit = contentChanged && product.suspendedAt !== null;

    // Conditional on the listing still being live (and, for a resubmission,
    // still suspended), so it can't race the cron's removal of an expired one.
    const { count } = await prisma.product.updateMany({
      where: { id: productId, archivedAt: null, ...(resubmit && { suspendedAt: { not: null } }) },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(stock !== undefined && { stock }),
        ...(unit !== undefined && { unit }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(categoryId !== undefined && { categoryId }),
        ...(contentChanged && { approved: false }),
        ...(resubmit && { suspendedAt: null, suspensionReasons: [], suspensionNote: null, suspendedById: null }),
      },
    });
    if (count === 0)
      return NextResponse.json({ error: "This listing changed, please refresh" }, { status: 409 });

    if (resubmit) {
      await prisma.auditLog.create({
        data: { action: "RESUBMIT_PRODUCT", entityType: "PRODUCT", entityId: productId, userId: user.id },
      });
    }

    const updated = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: { category: true, farmer: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ ...updated, price: Number(updated.price) });
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

    const product = await prisma.product.findUnique({ where: { id: productId, archivedAt: null } });
    if (!product)
      return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // Farmers can only delete their own products
    if (user.role === ROLES.FARMER && product.farmerId !== user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Staff remove a listing by suspending it first; deleting is only the
    // early way out of a suspension, before the cron's 7-day removal.
    const staff = user.role !== ROLES.FARMER;
    if (staff && !product.suspendedAt)
      return NextResponse.json({ error: "Only a suspended listing can be deleted. Suspend it first." }, { status: 409 });

    // Past orders, reviews and crop logs still point at a product, so one
    // with history is archived instead of deleted: it disappears from every
    // live listing but stays in order history.
    const result = await removeListing(productId, staff ? { suspendedAt: { not: null } } : {});
    if (result === "active-orders")
      return NextResponse.json(
        { error: "Cannot delete: this product has active orders. Wait for them to complete first." },
        { status: 409 },
      );
    if (result === "not-found")
      return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const archive = result === "archived";
    await prisma.auditLog.create({
      data: {
        action: archive ? "ARCHIVE_PRODUCT" : "DELETE_PRODUCT",
        entityType: "PRODUCT",
        entityId: productId,
        userId: user.id,
      },
    });

    return NextResponse.json({ message: archive ? "Product archived" : "Product deleted", archived: archive });
  } catch {
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
