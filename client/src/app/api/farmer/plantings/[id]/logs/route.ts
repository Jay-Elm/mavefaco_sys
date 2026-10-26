import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { fromDateString, toDateString } from "@/lib/planting";
import { NextRequest, NextResponse } from "next/server";
import { cropLogCreateSchema } from "@/validators/crop";

/** POST /api/farmer/plantings/[id]/logs — add an entry to a planting's log. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "farmer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const plantingId = Number((await params).id);
  if (!Number.isInteger(plantingId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  try {
    const planting = await prisma.planting.findFirst({ where: { id: plantingId, farmerId: actor.id } });
    if (!planting) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = cropLogCreateSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { observedOn, ...entry } = parsed.data;

    if (observedOn < toDateString(planting.plantedOn))
      return NextResponse.json({ error: "Date observed can't be before the planting date" }, { status: 400 });

    const log = await prisma.cropLog.create({
      data: { ...entry, observedOn: fromDateString(observedOn), plantingId },
    });
    return NextResponse.json({ ...log, observedOn }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add log" }, { status: 500 });
  }
}
