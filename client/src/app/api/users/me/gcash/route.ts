import { prisma } from "@/lib/prisma";
import { deletePrivateImages } from "@/lib/privateImages";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";
import { gcashSettingsSchema } from "@/validators/payment";
import { ROLES } from "@/lib/roles";

const SELECT = { gcashName: true, gcashNumber: true, gcashQrUrl: true } as const;

/**
 * PUT /api/users/me/gcash — save the account's GCash details. A farmer's
 * are shown to customers paying them, with an optional QR image; a
 * customer's only prefill the payment form.
 */
export async function PUT(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== ROLES.FARMER && actor.role !== ROLES.CUSTOMER)
    return NextResponse.json({ error: "Only farmers and customers have GCash details" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = gcashSettingsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { name, number, qrUrl } = parsed.data;

  const updated = await prisma.user.update({
    where: { id: actor.id },
    data: {
      gcashName: name,
      gcashNumber: number,
      ...(actor.role === ROLES.FARMER && { gcashQrUrl: qrUrl || null }),
    },
    select: SELECT,
  });
  return NextResponse.json(updated);
}

/** DELETE /api/users/me/gcash — remove them (a farmer then can't take GCash orders). */
export async function DELETE(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // A customer's private QR goes too; kept if storage won't delete it, so it isn't lost track of.
  const me = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { gcashQrPath: true } });
  const qrGone = await deletePrivateImages([me.gcashQrPath]);
  const updated = await prisma.user.update({
    where: { id: actor.id },
    data: { gcashName: null, gcashNumber: null, gcashQrUrl: null, ...(qrGone && { gcashQrPath: null }) },
    select: SELECT,
  });
  return NextResponse.json(updated);
}
