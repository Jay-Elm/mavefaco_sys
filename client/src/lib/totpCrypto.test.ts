import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptTotpSecret, encryptTotpSecret } from "./totpCrypto";

const JWT_A = "a".repeat(40);
const JWT_B = "b".repeat(40);
const KEY_1 = "1".repeat(40);
const KEY_2 = "2".repeat(40);
const SECRET = "JBSWY3DPEHPK3PXP";

beforeEach(() => {
  vi.stubEnv("JWT_SECRET", JWT_A);
  vi.stubEnv("TOTP_ENCRYPTION_KEY", "");
  vi.stubEnv("TOTP_ENCRYPTION_KEY_PREVIOUS", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("totpCrypto", () => {
  it("round-trips, and never stores the secret in the clear", () => {
    const encoded = encryptTotpSecret(SECRET);

    expect(encoded).not.toContain(SECRET);
    expect(decryptTotpSecret(encoded)).toEqual({ secret: SECRET, stale: false });
  });

  it("keeps working exactly as before when TOTP_ENCRYPTION_KEY isn't set (legacy key is current)", () => {
    expect(decryptTotpSecret(encryptTotpSecret(SECRET)).stale).toBe(false);
  });

  it("still reads legacy secrets once TOTP_ENCRYPTION_KEY is set, flagging them for re-encryption", () => {
    const legacy = encryptTotpSecret(SECRET);
    vi.stubEnv("TOTP_ENCRYPTION_KEY", KEY_1);

    expect(decryptTotpSecret(legacy)).toEqual({ secret: SECRET, stale: true });
    expect(decryptTotpSecret(encryptTotpSecret(SECRET)).stale).toBe(false);
  });

  it("is unaffected by rotating JWT_SECRET once secrets use TOTP_ENCRYPTION_KEY", () => {
    vi.stubEnv("TOTP_ENCRYPTION_KEY", KEY_1);
    const encoded = encryptTotpSecret(SECRET);

    vi.stubEnv("JWT_SECRET", JWT_B);

    expect(decryptTotpSecret(encoded)).toEqual({ secret: SECRET, stale: false });
  });

  it("supports rotating TOTP_ENCRYPTION_KEY via TOTP_ENCRYPTION_KEY_PREVIOUS", () => {
    vi.stubEnv("TOTP_ENCRYPTION_KEY", KEY_1);
    const underOld = encryptTotpSecret(SECRET);

    vi.stubEnv("TOTP_ENCRYPTION_KEY", KEY_2);
    expect(() => decryptTotpSecret(underOld)).toThrow(/could not be decrypted/);

    vi.stubEnv("TOTP_ENCRYPTION_KEY_PREVIOUS", KEY_1);
    expect(decryptTotpSecret(underOld)).toEqual({ secret: SECRET, stale: true });
  });

  it("rejects a TOTP_ENCRYPTION_KEY shorter than 32 characters", () => {
    vi.stubEnv("TOTP_ENCRYPTION_KEY", "too-short");
    expect(() => encryptTotpSecret(SECRET)).toThrow(/at least 32 characters/);
  });
});
