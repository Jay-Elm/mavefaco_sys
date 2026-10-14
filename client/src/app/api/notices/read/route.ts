import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";

/** POST /api/notices/read — mark all of the caller's notices read. */
export async function POST(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { count } = await prisma.notice.updateMany({
      where: { recipientId: actor.id, read: false },
      data: { read: true },
    });
    return NextResponse.json({ marked: count });
  } catch {
    return NextResponse.json({ error: "Failed to update notices" }, { status: 500 });
  }
}
