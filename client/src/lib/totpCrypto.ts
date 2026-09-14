import crypto from "crypto";
import { getJwtSecret } from "./auth";

// AES-256-GCM at rest for User.totpSecret — a bare TOTP secret in the DB is
// equivalent to a permanently-valid second factor for whoever reads it, so
// (unlike PasswordResetToken/backup codes, which are meant to be looked up
// by hash) this needs to be reversible but never stored in the clear.
// Keyed off JWT_SECRET via scrypt rather than a new env var: JWT_SECRET is
// already validated for strength (see getJwtSecret) and already rotated
// through the same Vercel deploy process, so this avoids one more secret
// to provision without weakening the guarantee.
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (!cachedKey) {
    cachedKey = crypto.scryptSync(getJwtSecret(), "totp-secret-encryption-v1", 32);
  }
  return cachedKey;
}

export function encryptTotpSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptTotpSecret(encoded: string): string {
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
