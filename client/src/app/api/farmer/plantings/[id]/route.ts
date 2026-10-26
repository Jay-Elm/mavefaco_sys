import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { addDays, daysBetween, fromDateString, plantingInclude, serializePlanting, toDateString } from "@/lib/planting";
import { NextRequest, NextResponse } from "next/server";
import { plantingUpdateSchema } from "@/validators/crop";

type Context = { params: Promise<{ id: string }> };

/** The signed-in farmer and the id of one of their plantings, or the error response. */
async function ownPlanting(req: NextRequest, context: Context) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return { ok: false as const, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (actor.role !== "farmer") return { ok: false as const, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return { ok: false as const, error: NextResponse.json({ error: "Invalid ID" }, { status: 400 }) };
  const planting = await prisma.planting.findFirst({ where: { id, farmerId: actor.id } });
  if (!planting) return { ok: false as const, error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { ok: true as const, actor, planting };
}

/** GET /api/farmer/plantings/[id] — one planting with its log, newest first. */
export async function GET(req: NextRequest, context: Context) {
  try {
    const own = await ownPlanting(req, context);
    if (!own.ok) return own.error;
    const planting = await prisma.planting.findUniqueOrThrow({
      where: { id: own.planting.id },
      include: { ...plantingInclude, logs: { orderBy: [{ observedOn: "desc" }, { id: "desc" }] } },
    });
    return NextResponse.json({
      ...serializePlanting(planting),
      logs: planting.logs.map((l) => ({ ...l, observedOn: toDateString(l.observedOn) })),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch planting" }, { status: 500 });
  }
}

/**
 * PATCH /api/farmer/plantings/[id] — correct details, adjust the harvest
 * window, link a listing, or mark the planting failed (or back to growing,
 * which also undoes a recorded harvest; stock already added stays).
 */
export async function PATCH(req: NextRequest, context: Context) {
  try {
    const own = await ownPlanting(req, context);
    if (!own.ok) return own.error;
    const { actor, planting } = own;

    const parsed = plantingUpdateSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const body = parsed.data;

    if (body.productId != null) {
      const product = await prisma.product.findFirst({ where: { id: body.productId, farmerId: actor.id, archivedAt: null } });
      if (!product) return NextResponse.json({ error: "Choose one of your own listings" }, { status: 400 });
    }
    if (body.status === "failed" && planting.status !== "growing")
      return NextResponse.json({ error: "Only a growing planting can be marked failed" }, { status: 409 });

    // A new planting date moves the harvest window with it, unless a new
    // window is given too.
    let harvestStart = body.harvestStart;
    let harvestEnd = body.harvestEnd;
    if (body.plantedOn && !harvestStart) {
      const shift = daysBetween(toDateString(planting.plantedOn), body.plantedOn);
      harvestStart = addDays(toDateString(planting.harvestStart), shift);
      harvestEnd = addDays(toDateString(planting.harvestEnd), shift);
    }
    const plantedOn = body.plantedOn ?? toDateString(planting.plantedOn);
    if (harvestStart && harvestStart <= plantedOn)
      return NextResponse.json({ error: "Harvest has to start after the planting date" }, { status: 400 });

    // Conditional on the row being as we read it: the shift above and the
    // status check were worked out from that version.
    const { count } = await prisma.planting.updateMany({
      where: { id: planting.id, farmerId: actor.id, updatedAt: planting.updatedAt },
      data: {
        ...(body.plantedOn && { plantedOn: fromDateString(body.plantedOn) }),
        ...(harvestStart && { harvestStart: fromDateString(harvestStart) }),
        ...(harvestEnd && { harvestEnd: fromDateString(harvestEnd) }),
        ...(body.areaSqm !== undefined && { areaSqm: body.areaSqm }),
        ...(body.expectedYield !== undefined && { expectedYield: body.expectedYield }),
        ...(body.productId !== undefined && { productId: body.productId }),
        ...(body.status && { status: body.status }),
        ...(body.status === "growing" && { harvestedOn: null, actualYield: null }),
      },
    });
    if (count === 0)
      return NextResponse.json({ error: "This planting changed, please refresh" }, { status: 409 });

    const updated = await prisma.planting.findUniqueOrThrow({ where: { id: planting.id }, include: plantingInclude });
    return NextResponse.json(serializePlanting(updated));
  } catch {
    return NextResponse.json({ error: "Failed to update planting" }, { status: 500 });
  }
}

/** DELETE /api/farmer/plantings/[id] — remove a planting recorded by mistake, with its log. */
export async function DELETE(req: NextRequest, context: Context) {
  try {
    const own = await ownPlanting(req, context);
    if (!own.ok) return own.error;
    await prisma.planting.deleteMany({ where: { id: own.planting.id, farmerId: own.actor.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete planting" }, { status: 500 });
  }
}
