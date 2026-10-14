import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";

/** GET /api/notices — the caller's system notices, newest first. */
export async function GET(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const notices = await prisma.notice.findMany({
      where: { recipientId: actor.id },
      orderBy: { id: "desc" },
      take: 100,
      include: { product: { select: { id: true, name: true, archivedAt: true, suspendedAt: true } } },
    });
    return NextResponse.json(notices);
  } catch {
    return NextResponse.json({ error: "Failed to fetch notices" }, { status: 500 });
  }
}
