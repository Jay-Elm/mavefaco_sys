import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> },
) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: productIdParam, reviewId } = await params;
    const id = Number(reviewId);
    const productId = Number(productIdParam);
    if (isNaN(id) || isNaN(productId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review || review.productId !== productId)
      return NextResponse.json({ error: "Review not found" }, { status: 404 });

    const isOwner = review.customerId === actor.id;
    const isStaff = authorize(actor, [ROLES.ADMIN, ROLES.MANAGER]);
    if (!isOwner && !isStaff)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Conditional delete, so a double-click can't log two removals. Staff
    // removing someone else's review is audited; a customer deleting their
    // own is not.
    const { count } = await prisma.review.deleteMany({ where: { id } });
    if (count === 0) return NextResponse.json({ error: "Review not found" }, { status: 404 });
    if (!isOwner)
      await prisma.auditLog.create({
        data: { action: "DELETE_REVIEW", entityType: "REVIEW", entityId: id, userId: actor.id },
      });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }
}
