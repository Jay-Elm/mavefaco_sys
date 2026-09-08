import { randomBytes, createHash } from "crypto";

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
// Longer than the password-reset window on purpose: an unverified email
// isn't a live security risk the way a stale password-reset link is, so
// there's no reason to rush someone who signed up and didn't check their
// inbox right away.
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** A high-entropy random token doesn't need bcrypt's slow hashing — that's
 *  for defending low-entropy user-chosen secrets against brute force.
 *  SHA-256 lets the DB lookup happen by direct equality on an indexed column.
 *  Shared by password-reset and email-verification tokens — both are
 *  "random secret, stored hashed, single-use, time-limited" with the same
 *  properties, just different TTLs and tables. */
export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
