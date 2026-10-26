import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";

/** DELETE /api/farmer/plantings/[id]/logs/[logId] — remove an entry from the farmer's own log. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> },
) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "farmer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, logId } = await params;
  const plantingId = Number(id);
  const logIdNum = Number(logId);
  if (!Number.isInteger(plantingId) || !Number.isInteger(logIdNum))
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  try {
    const { count } = await prisma.cropLog.deleteMany({
      where: { id: logIdNum, plantingId, planting: { farmerId: actor.id } },
    });
    if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete log" }, { status: 500 });
  }
}
