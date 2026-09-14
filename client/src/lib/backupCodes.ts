import crypto from "crypto";
import bcrypt from "bcryptjs";

const BACKUP_CODE_COUNT = 10;
// Excludes 0/O/1/I/L — characters that are easy to misread when a user is
// copying a code down by hand off a screen.
const CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomCode(): string {
  const bytes = crypto.randomBytes(8);
  let raw = "";
  for (const byte of bytes) raw += CHARSET[byte % CHARSET.length];
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

/** Plaintext codes to show the user once, alongside their bcrypt hashes to store. */
export async function generateBackupCodes(): Promise<{ code: string; hash: string }[]> {
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, () => randomCode());
  return Promise.all(codes.map(async (code) => ({ code, hash: await bcrypt.hash(code, 10) })));
}

export function normalizeBackupCode(input: string): string {
  return input.trim().toUpperCase();
}
