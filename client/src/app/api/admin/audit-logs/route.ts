import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

const AUDIT_PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  try {
    const user = await getActiveAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(user, [ROLES.ADMIN, ROLES.MANAGER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Newest first, a page at a time: ?before=<id> continues from the last
    // entry the client has (ids only ever increase, so they're a stable cursor).
    const before = Number(new URL(req.url).searchParams.get("before"));
    const logs = await prisma.auditLog.findMany({
      take: AUDIT_PAGE_SIZE,
      ...(Number.isInteger(before) && before > 0 && { where: { id: { lt: before } } }),
      orderBy: { id: "desc" },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });

    return NextResponse.json(logs);
  } catch {
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
