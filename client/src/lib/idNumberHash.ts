import { createHash, createHmac } from "node:crypto";
import { getJwtSecret } from "@/lib/auth";
import { normalizeIdNumber } from "@/lib/idVerification";

/**
 * A keyed fingerprint of an ID number: the same ID gives the same value, so
 * a second account using it can be spotted, but the number can't be read
 * back or brute-forced without the key. Keyed by ID_NUMBER_HASH_KEY; outside
 * production a key derived from JWT_SECRET stands in, so local development
 * and tests work without another secret.
 */
export function hashIdNumber(idType: string, raw: string): string {
  return createHmac("sha256", hashKey()).update(`${idType}:${normalizeIdNumber(raw)}`).digest("hex");
}

/** The last 4 characters of the normalized number, which staff see. */
export function idNumberLast4(raw: string): string {
  return normalizeIdNumber(raw).slice(-4);
}

function hashKey(): string {
  const key = process.env.ID_NUMBER_HASH_KEY;
  if (key && key.length >= 32) return key;
  if (process.env.NODE_ENV === "production") throw new Error("ID_NUMBER_HASH_KEY must be set (at least 32 characters)");
  return createHash("sha256").update(`id-number-hash:${getJwtSecret()}`).digest("hex");
}
