import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { cropLinkData } from "@/lib/cropLink";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const body = z.object({
  cropTypeId: z.number().int().positive().nullable().optional(),
  notACrop: z.boolean().optional(),
});

/**
 * PATCH /api/admin/products/[id]/crop — staff link a listing to the crop it
 * sells (or mark it "not a farm crop"), so its sales count on the Market
 * page. Customers don't see the crop, so the listing's review status is
 * untouched. Audited.
 */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!authorize(actor, [ROLES.ADMIN, ROLES.MANAGER])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const link = await cropLinkData(parsed.data.cropTypeId, parsed.data.notACrop);
  if ("error" in link) return NextResponse.json({ error: link.error }, { status: 400 });

  const { count } = await prisma.product.updateMany({ where: { id, archivedAt: null }, data: link.data });
  if (count === 0) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  await prisma.auditLog.create({ data: { action: "LINK_PRODUCT_CROP", entityType: "PRODUCT", entityId: id, userId: actor.id } });
  const product = await prisma.product.findUniqueOrThrow({
    where: { id },
    select: { id: true, cropTypeId: true, notACrop: true, cropType: { select: { id: true, name: true } } },
  });
  return NextResponse.json(product);
}
