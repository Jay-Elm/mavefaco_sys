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

    const { reviewId } = await params;
    const id = Number(reviewId);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });

    const isOwner = review.customerId === actor.id;
    const isAdmin = authorize(actor, [ROLES.ADMIN, ROLES.MANAGER]);
    if (!isOwner && !isAdmin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.review.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }
}
