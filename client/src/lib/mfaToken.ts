import jwt from "jsonwebtoken";
import { getJwtSecret } from "./auth";

export const MFA_PENDING_COOKIE = "mfa_pending";
const MFA_PENDING_TTL_SECONDS = 5 * 60;

export type MfaPurpose = "setup" | "verify";

interface MfaPendingPayload {
  id: number;
  purpose: MfaPurpose;
}

/**
 * A separate, short-lived, purpose-scoped token — distinct from the main
 * session cookie ("token") — issued after password verification but before
 * the second factor is satisfied. Deliberately NOT the real session: it
 * carries no tokenVersion and unlocks nothing except the /api/auth/mfa/*
 * endpoints, so a leaked pending token is only useful for 5 minutes and only
 * to attempt (rate-limited) MFA codes against an account whose password the
 * attacker would already need to know to have gotten one.
 */
export function signMfaPendingToken(userId: number, purpose: MfaPurpose): string {
  const payload: MfaPendingPayload = { id: userId, purpose };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: MFA_PENDING_TTL_SECONDS });
}

export function verifyMfaPendingToken(token: string, expectedPurpose: MfaPurpose): number | null {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    !("id" in decoded) ||
    !("purpose" in decoded) ||
    (decoded as MfaPendingPayload).purpose !== expectedPurpose
  ) {
    return null;
  }
  const { id } = decoded as MfaPendingPayload;
  return typeof id === "number" ? id : null;
}

export const mfaPendingCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MFA_PENDING_TTL_SECONDS,
};
