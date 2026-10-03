import crypto from "crypto";
import { getJwtSecret } from "./auth";

// AES-256-GCM at rest for User.totpSecret — a bare TOTP secret in the DB is
// equivalent to a permanently-valid second factor for whoever reads it, so
// (unlike PasswordResetToken/backup codes, which are meant to be looked up
// by hash) this needs to be reversible but never stored in the clear.
//
// Keyed off its own TOTP_ENCRYPTION_KEY, deliberately NOT JWT_SECRET: when
// the two were coupled, rotating JWT_SECRET made every stored secret
// undecryptable and locked out every admin and manager at once. Decryption
// tries each key below in order (GCM's auth tag tells us which one fits):
//   1. TOTP_ENCRYPTION_KEY           — current key; all new encryption uses it
//   2. TOTP_ENCRYPTION_KEY_PREVIOUS  — set this to the old value while rotating
//   3. the legacy JWT_SECRET-derived key, for secrets stored before the split
// A secret that only decrypts with 2 or 3 is reported as `stale` so the
// caller can re-encrypt it under the current key after a successful login.
// Until TOTP_ENCRYPTION_KEY is configured, the legacy key stays primary so
// nothing changes for existing deployments.
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const MIN_KEY_LENGTH = 32;

const derivedKeys = new Map<string, Buffer>();
function derive(source: string, salt: string): Buffer {
  const cacheKey = `${salt}\0${source}`;
  let key = derivedKeys.get(cacheKey);
  if (!key) {
    key = crypto.scryptSync(source, salt, 32);
    derivedKeys.set(cacheKey, key);
  }
  return key;
}

function configuredKey(name: "TOTP_ENCRYPTION_KEY" | "TOTP_ENCRYPTION_KEY_PREVIOUS"): Buffer | null {
  const value = process.env[name];
  if (!value) return null;
  if (value.length < MIN_KEY_LENGTH) {
    throw new Error(`${name} must be at least ${MIN_KEY_LENGTH} characters`);
  }
  return derive(value, "totp-secret-encryption-v2");
}

function legacyKey(): Buffer | null {
  try {
    return derive(getJwtSecret(), "totp-secret-encryption-v1");
  } catch {
    return null;
  }
}

/** Decryption candidates, current key first. */
function keys(): Buffer[] {
  const list = [configuredKey("TOTP_ENCRYPTION_KEY"), configuredKey("TOTP_ENCRYPTION_KEY_PREVIOUS"), legacyKey()];
  return list.filter((k): k is Buffer => k !== null);
}

export function encryptTotpSecret(plaintext: string): string {
  const [key] = keys();
  if (!key) throw new Error("No TOTP encryption key available (set TOTP_ENCRYPTION_KEY)");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Throws if no available key can decrypt `encoded`. `stale` means it was
 * encrypted under an older key and should be re-encrypted.
 */
export function decryptTotpSecret(encoded: string): { secret: string; stale: boolean } {
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const candidates = keys();
  for (const [index, key] of candidates.entries()) {
    try {
      const decipher = crypto.createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(authTag);
      const secret = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
      return { secret, stale: index > 0 };
    } catch {
      // Wrong key (auth tag mismatch) — try the next one.
    }
  }
  throw new Error("TOTP secret could not be decrypted with any configured key");
}
