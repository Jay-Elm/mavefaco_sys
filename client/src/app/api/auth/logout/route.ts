import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/getAuthUser";
import { NextRequest, NextResponse } from "next/server";

/**
 * Bumps the user's tokenVersion so the token just used (and any other
 * outstanding token for this account) is immediately rejected by
 * getActiveAuthUser, instead of staying valid until its 7-day expiry.
 * Uses getAuthUser (not getActiveAuthUser) so a suspended account can
 * still invalidate its own leaked/stale tokens.
 */
export async function POST(req: NextRequest) {
  const actor = getAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.user.update({
      where: { id: actor.id },
      data: { tokenVersion: { increment: 1 } },
    });
    return NextResponse.json({ message: "Logged out" });
  } catch {
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
