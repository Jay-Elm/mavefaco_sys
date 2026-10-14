import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "./auth";
import { prisma } from "./prisma";

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

/** Where each role lands; the storefront home for customers. */
export const ROLE_HOME: Record<string, string> = {
  admin: "/dashboard",
  manager: "/dashboard",
  farmer: "/farmer",
  customer: "/products",
};

/**
 * The signed-in user for the page being rendered, from the session cookie,
 * with the same checks as getActiveAuthUser (valid token, not suspended,
 * not revoked by a tokenVersion bump). Lets server-rendered pages draw the
 * right navbar and redirect by role before anything reaches the browser,
 * instead of drawing the signed-out page first.
 *
 * Wrapped in cache(): the root layout and a page share one lookup per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get("token")?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, name: true, email: true, role: true, suspended: true, tokenVersion: true },
  });
  if (!user || user.suspended || user.tokenVersion !== payload.tokenVersion) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role };
});

/** Sends a signed-in user whose role is in `roles` to their own home page. */
export async function redirectRoles(roles: string[]): Promise<void> {
  const user = await getSessionUser();
  if (user && roles.includes(user.role)) redirect(ROLE_HOME[user.role] ?? "/");
}
