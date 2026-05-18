import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const productId = Number(id);
  if (isNaN(productId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  try {
    const reviews = await prisma.review.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      include: { customer: { select: { id: true, name: true } } },
    });
    return NextResponse.json(reviews);
  } catch {
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (actor.role !== "customer")
      return NextResponse.json({ error: "Only customers can leave reviews" }, { status: 403 });

    const { id } = await params;
    const productId = Number(id);
    if (isNaN(productId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    // Must have a delivered order containing this product
    const eligibleOrder = await prisma.order.findFirst({
      where: {
        customerId: actor.id,
        status: "delivered",
        items: { some: { productId } },
      },
    });
    if (!eligibleOrder)
      return NextResponse.json(
        { error: "You can only review products from delivered orders" },
        { status: 403 },
      );

    // One review per customer per product
    const existing = await prisma.review.findUnique({
      where: { customerId_productId: { customerId: actor.id, productId } },
    });
    if (existing)
      return NextResponse.json({ error: "You have already reviewed this product" }, { status: 409 });

    const { rating, comment } = await req.json();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 });

    const review = await prisma.review.create({
      data: {
        customerId: actor.id,
        productId,
        rating,
        comment: comment?.trim() || null,
      },
      include: { customer: { select: { id: true, name: true } } },
    });

    return NextResponse.json(review, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
