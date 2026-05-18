import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(actor, [ROLES.ADMIN]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const bannerId = parseInt(id);
    if (isNaN(bannerId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = await req.json();
    const validColors = ["green", "orange", "blue", "purple", "teal"];

    const banner = await prisma.banner.update({
      where: { id: bannerId },
      data: {
        ...(body.title !== undefined && { title: body.title.trim() }),
        ...(body.subtitle !== undefined && { subtitle: body.subtitle?.trim() || null }),
        ...(body.ctaText !== undefined && { ctaText: body.ctaText?.trim() || null }),
        ...(body.ctaLink !== undefined && { ctaLink: body.ctaLink?.trim() || null }),
        ...(body.color !== undefined && { color: validColors.includes(body.color) ? body.color : "green" }),
        ...(body.active !== undefined && { active: Boolean(body.active) }),
        ...(body.displayOrder !== undefined && { displayOrder: Number(body.displayOrder) }),
      },
    });
    return NextResponse.json(banner);
  } catch {
    return NextResponse.json({ error: "Failed to update banner" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(actor, [ROLES.ADMIN]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const bannerId = parseInt(id);
    if (isNaN(bannerId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    await prisma.banner.delete({ where: { id: bannerId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete banner" }, { status: 500 });
  }
}
