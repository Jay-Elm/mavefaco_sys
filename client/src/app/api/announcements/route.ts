import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { announcementCreateSchema, type AnnouncementAudience } from "@/validators/announcement";

/**
 * GET /api/announcements — the announcements the caller may see: staff see
 * all of them, farmers those for everyone or farmers, and customers and
 * guests those for everyone or customers.
 */
export async function GET(req: NextRequest) {
  try {
    const viewer = await getActiveAuthUser(req);
    const isStaff = !!viewer && authorize(viewer, [ROLES.ADMIN, ROLES.MANAGER]);
    const audiences: AnnouncementAudience[] =
      viewer?.role === ROLES.FARMER ? ["everyone", "farmers"] : ["everyone", "customers"];
    const announcements = await prisma.announcement.findMany({
      where: isStaff ? {} : { audience: { in: audiences } },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { name: true, role: true } } },
    });
    return NextResponse.json(announcements);
  } catch {
    return NextResponse.json({ error: "Failed to fetch announcements" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(actor, [ROLES.ADMIN, ROLES.MANAGER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = announcementCreateSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { title, body, type, audience } = parsed.data;

    const announcement = await prisma.announcement.create({
      data: { title, body, type, audience, authorId: actor.id },
      include: { author: { select: { name: true, role: true } } },
    });

    await logAudit("CREATE_ANNOUNCEMENT", "ANNOUNCEMENT", announcement.id, actor.id);

    return NextResponse.json(announcement, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}
