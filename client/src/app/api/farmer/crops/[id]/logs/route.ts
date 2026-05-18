import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";

const VALID_TYPES = ["weather_impact", "pest_disease", "damage", "note"];

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
    const { type, note } = await req.json();
    if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    if (!note?.trim()) return NextResponse.json({ error: "Note is required" }, { status: 400 });

    const log = await prisma.cropLog.create({
      data: { productId, type, note: note.trim() },
    });
    return NextResponse.json(log, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add log" }, { status: 500 });
  }
}
