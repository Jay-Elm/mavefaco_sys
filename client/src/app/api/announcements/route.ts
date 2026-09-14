import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { announcementCreateSchema } from "@/validators/announcement";

export async function GET() {
  try {
    const announcements = await prisma.announcement.findMany({
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
    const { title, body, type } = parsed.data;

    const announcement = await prisma.announcement.create({
      data: { title, body, type, authorId: actor.id },
      include: { author: { select: { name: true, role: true } } },
    });

    return NextResponse.json(announcement, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}
