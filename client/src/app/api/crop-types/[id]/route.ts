import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { cropTypeSchema } from "@/validators/crop";

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002";

async function staffAndId(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getActiveAuthUser(req);
  if (!user) return { ok: false as const, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!authorize(user, [ROLES.ADMIN, ROLES.MANAGER]))
    return { ok: false as const, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return { ok: false as const, error: NextResponse.json({ error: "Invalid ID" }, { status: 400 }) };
  return { ok: true as const, user, id };
}

/**
 * PUT /api/crop-types/[id] — correct a crop's name or growing times.
 * Existing plantings keep the harvest window they were given; stages are
 * worked out from the new schedule.
 */
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await staffAndId(req, context);
    if (!auth.ok) return auth.error;

    const parsed = cropTypeSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const { count } = await prisma.cropType.updateMany({
      where: { id: auth.id },
      data: { floweringDay: null, fruitingDay: null, ...parsed.data },
    });
    if (count === 0) return NextResponse.json({ error: "Crop type not found" }, { status: 404 });
    await logAudit("UPDATE_CROP_TYPE", "CROP_TYPE", auth.id, auth.user.id);

    const cropType = await prisma.cropType.findUniqueOrThrow({
      where: { id: auth.id },
      include: { _count: { select: { plantings: true } } },
    });
    return NextResponse.json(cropType);
  } catch (err) {
    if (isUniqueViolation(err))
      return NextResponse.json({ error: "A crop with that name already exists" }, { status: 409 });
    return NextResponse.json({ error: "Failed to update crop type" }, { status: 500 });
  }
}

/** DELETE /api/crop-types/[id] — only while no planting uses it. */
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await staffAndId(req, context);
    if (!auth.ok) return auth.error;

    const plantings = await prisma.planting.count({ where: { cropTypeId: auth.id } });
    if (plantings > 0)
      return NextResponse.json(
        { error: `Cannot delete: ${plantings} planting(s) are recorded for this crop` },
        { status: 409 },
      );

    // The foreign key still guards a planting recorded in between.
    const { count } = await prisma.cropType.deleteMany({ where: { id: auth.id } });
    if (count === 0) return NextResponse.json({ error: "Crop type not found" }, { status: 404 });
    await logAudit("DELETE_CROP_TYPE", "CROP_TYPE", auth.id, auth.user.id);

    return NextResponse.json({ message: "Crop type deleted" });
  } catch (err) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2003")
      return NextResponse.json({ error: "Cannot delete: a planting was just recorded for this crop" }, { status: 409 });
    return NextResponse.json({ error: "Failed to delete crop type" }, { status: 500 });
  }
}
