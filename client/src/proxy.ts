import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { ROLES } from "@/lib/roles";

/**
 * Structural backstop for /api/admin/*: every route under this prefix
 * already calls getActiveAuthUser + authorize() itself, but that's
 * per-file discipline — nothing stops a future route from forgetting the
 * check. This runs before any of them and rejects outright if there's no
 * validly-signed session cookie carrying an admin/manager role.
 *
 * This is an "optimistic" check only (signature + role from the JWT, no DB
 * lookup) per Next's guidance for Proxy — it runs on every matching
 * request, so a DB round trip here would be wasteful. It does NOT replace
 * the route-level getActiveAuthUser check, which also verifies the account
 * isn't suspended and the token hasn't been revoked (tokenVersion) — that
 * defense-in-depth layer still runs on every route as before.
 */
export function proxy(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? verifyToken(token) : null;

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (payload.role !== ROLES.ADMIN && payload.role !== ROLES.MANAGER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/admin/:path*"],
};
