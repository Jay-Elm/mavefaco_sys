import { randomBytes, createHash } from "crypto";

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** A high-entropy random token doesn't need bcrypt's slow hashing — that's
 *  for defending low-entropy user-chosen secrets against brute force.
 *  SHA-256 lets the DB lookup happen by direct equality on an indexed column. */
export function generateResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashResetToken(raw) };
}

export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
