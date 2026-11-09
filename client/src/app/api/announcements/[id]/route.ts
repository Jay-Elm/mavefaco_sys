import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { announcementPinSchema } from "@/validators/announcement";

/** PATCH { pinned } — staff pin an announcement (shown first to its audience) or unpin it. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(actor, [ROLES.ADMIN, ROLES.MANAGER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const announcementId = parseInt((await params).id);
    if (isNaN(announcementId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    const parsed = announcementPinSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const found = await prisma.announcement.findUnique({ where: { id: announcementId }, select: { id: true } });
    if (!found) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });

    const announcement = await prisma.announcement.update({
      where: { id: announcementId },
      data: { pinnedAt: parsed.data.pinned ? new Date() : null },
      include: { author: { select: { name: true, role: true } } },
    });
    await logAudit(parsed.data.pinned ? "PIN_ANNOUNCEMENT" : "UNPIN_ANNOUNCEMENT", "ANNOUNCEMENT", announcementId, actor.id);
    return NextResponse.json(announcement);
  } catch {
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(actor, [ROLES.ADMIN, ROLES.MANAGER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const announcementId = parseInt(id);
    if (isNaN(announcementId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    await prisma.announcement.delete({ where: { id: announcementId } });
    await logAudit("DELETE_ANNOUNCEMENT", "ANNOUNCEMENT", announcementId, actor.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 });
  }
}
