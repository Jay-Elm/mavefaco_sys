import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> },
) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "farmer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, logId } = await params;
  const productId = Number(id);
  const logIdNum = Number(logId);
  if (isNaN(productId) || isNaN(logIdNum))
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const log = await prisma.cropLog.findUnique({ where: { id: logIdNum } });
  if (!log || log.productId !== productId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // verify farmer owns this product
  const product = await prisma.product.findUnique({ where: { id: productId, farmerId: actor.id } });
  if (!product) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.cropLog.delete({ where: { id: logIdNum } });
  return NextResponse.json({ success: true });
}
