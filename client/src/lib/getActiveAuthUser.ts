import { NextRequest } from "next/server";
import { verifyToken, JwtPayload } from "./auth";
import { prisma } from "./prisma";

/**
 * Like getAuthUser but also checks the database for suspension.
 * Returns null if the token is invalid, the user doesn't exist, or the user is suspended.
 */
export async function getActiveAuthUser(req: NextRequest): Promise<JwtPayload | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { suspended: true },
  });

  if (!dbUser || dbUser.suspended) return null;

  return payload;
}
