import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { getJwtSecret } from "./auth";

interface SessionUser {
  id: number;
  email: string;
  role: string;
  tokenVersion: number;
}

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Shared by the plain login route and the two MFA completion routes
 * (setup-confirm, verify) — every path that ends in "the user is now fully
 * logged in" issues the same signed cookie the same way.
 */
export function issueSessionResponse(user: SessionUser, body: Record<string, unknown>): NextResponse {
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion },
    getJwtSecret(),
    { expiresIn: "7d" },
  );

  const response = NextResponse.json(body);
  // httpOnly so client-side JS (and any XSS) can never read the token;
  // SameSite=Lax blocks it from being sent on cross-site requests (CSRF)
  // while still allowing normal top-level navigation to the site.
  response.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
