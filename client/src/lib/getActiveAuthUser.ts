import { NextRequest } from "next/server";
import { JwtPayload } from "./auth";
import { getAuthUser } from "./getAuthUser";
import { prisma } from "./prisma";

/**
 * Like getAuthUser but also checks the database for suspension and for a
 * revoked (stale tokenVersion) session.
 * Returns null if the token is invalid, the user doesn't exist, is
 * suspended, or the token has been revoked since it was issued.
 */
export async function getActiveAuthUser(req: NextRequest): Promise<JwtPayload | null> {
  const payload = getAuthUser(req);
  if (!payload) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { suspended: true, tokenVersion: true },
  });

  if (!dbUser || dbUser.suspended) return null;
  if (dbUser.tokenVersion !== payload.tokenVersion) return null;

  return payload;
}
