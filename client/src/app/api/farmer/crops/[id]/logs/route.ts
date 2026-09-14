import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";
import { cropLogCreateSchema } from "@/validators/crop";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "farmer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const productId = Number(id);
  if (isNaN(productId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const product = await prisma.product.findUnique({ where: { id: productId, farmerId: actor.id } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const parsed = cropLogCreateSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { type, note } = parsed.data;

    const log = await prisma.cropLog.create({
      data: { productId, type, note },
    });
    return NextResponse.json(log, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add log" }, { status: 500 });
  }
}
