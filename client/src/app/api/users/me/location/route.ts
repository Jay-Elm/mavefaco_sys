import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";
import { deliveryLocationSchema } from "@/validators/payment";
import { deliveryTownAt } from "@/lib/deliveryArea";
import { ROLES } from "@/lib/roles";

const SELECT = { deliveryLat: true, deliveryLng: true, deliveryAddress: true, deliveryTown: true } as const;

/**
 * PUT /api/users/me/location — save the customer's delivery spot. A spot
 * outside the delivery area is saved too (deliveryTown null); checkout then
 * offers pickup only.
 */
export async function PUT(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== ROLES.CUSTOMER)
    return NextResponse.json({ error: "Only customer accounts have a delivery location" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = deliveryLocationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { lat, lng, address } = parsed.data;

  const updated = await prisma.user.update({
    where: { id: actor.id },
    // ~1 m precision is plenty, and no more than needed is kept.
    data: { deliveryLat: round5(lat), deliveryLng: round5(lng), deliveryAddress: address, deliveryTown: deliveryTownAt(lat, lng) },
    select: SELECT,
  });
  return NextResponse.json(updated);
}

/** DELETE /api/users/me/location — forget the saved spot. */
export async function DELETE(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const updated = await prisma.user.update({
    where: { id: actor.id },
    data: { deliveryLat: null, deliveryLng: null, deliveryAddress: null, deliveryTown: null },
    select: SELECT,
  });
  return NextResponse.json(updated);
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
