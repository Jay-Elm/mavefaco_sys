import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { ROLES } from "@/lib/roles";
import { buildCsp, generateNonce } from "@/lib/csp";

/**
 * Runs before matching requests (see `config.matcher`) and does two jobs:
 *
 * 1. /api/admin/* — a structural backstop: every route under this prefix
 *    already calls getActiveAuthUser + authorize() itself, but that's
 *    per-file discipline. This rejects outright if there's no validly
 *    signed session cookie carrying an admin/manager role. It's an
 *    "optimistic" check (signature + role from the JWT, no DB lookup); the
 *    route-level check, which also catches suspension and revoked tokens,
 *    still runs on every route.
 *
 * 2. Pages — a fresh CSP nonce per request. Next.js reads the nonce from
 *    the Content-Security-Policy request header and stamps it on its own
 *    scripts during rendering; the same policy goes out on the response.
 *    This only works because every page renders per request (the root
 *    layout awaits connection()).
 */
export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/admin")) return guardAdminApi(req);
  return withCsp(req);
}

function guardAdminApi(req: NextRequest) {
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

function withCsp(req: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV === "development" });

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/api/admin/:path*",
    {
      // Every page; not other API routes, build assets or the favicon.
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      // next/link prefetches fetch RSC payloads, not HTML; they need no CSP.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
