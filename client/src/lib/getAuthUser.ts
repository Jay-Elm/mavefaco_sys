import { NextRequest } from "next/server";
import { verifyToken, JwtPayload } from "./auth";

/**
 * Reads the session token from the httpOnly "token" cookie (the source of
 * truth as of the cookie-based auth migration) and falls back to an
 * "Authorization: Bearer" header for any caller that still sends one —
 * legacy client code sends a harmless placeholder there now, but this also
 * keeps the door open for a non-browser API client to authenticate directly.
 */
export function getAuthUser(req: NextRequest): JwtPayload | null {
  const cookieToken = req.cookies.get("token")?.value;
  const authHeader = req.headers.get("authorization");
  const headerToken = authHeader?.split(" ")[1];
  const token = cookieToken || headerToken;
  if (!token) return null;
  return verifyToken(token);
}
