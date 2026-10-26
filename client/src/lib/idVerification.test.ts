import { describe, expect, it, vi } from "vitest";
import { ID_TYPES, idNumberError, normalizeIdNumber } from "./idVerification";
import { hashIdNumber, idNumberLast4 } from "./idNumberHash";
import { imageSize } from "./imageSniff";

describe("ID numbers", () => {
  it("ignore spaces, dashes and case, and a PRN label", () => {
    expect(normalizeIdNumber(" n01-12 345678 ")).toBe("N0112345678");
    expect(normalizeIdNumber("PRN 100141234567")).toBe("100141234567");
  });

  it("accept each type's own example, and reject obviously wrong numbers", () => {
    for (const t of ID_TYPES) expect(idNumberError(t.key, t.numberExample), t.key).toBeNull();
    expect(idNumberError("drivers_license", "12345")).toMatch(/Driver's License/);
    expect(idNumberError("passport", "")).toBe("Enter the ID number");
    expect(idNumberError("nope", "123")).toBe("Choose an ID type");
  });

  it("give the same fingerprint for the same ID however it's typed, and a different one per type", () => {
    vi.stubEnv("ID_NUMBER_HASH_KEY", "unit-test-id-number-hash-key-0123456789");
    expect(hashIdNumber("umid", "0111-1234567-8")).toBe(hashIdNumber("umid", "011112345678"));
    expect(hashIdNumber("umid", "011112345678")).not.toBe(hashIdNumber("philsys", "011112345678"));
    expect(hashIdNumber("umid", "011112345678")).not.toContain("011112345678");
    expect(idNumberLast4("0111-1234567-8")).toBe("5678");
    vi.unstubAllEnvs();
  });
});

describe("imageSize", () => {
  it("reads PNG and JPEG headers", () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    png.set([0, 0, 0x06, 0x40, 0, 0, 0x03, 0xf0], 16); // 1600 × 1008
    expect(imageSize(png)).toEqual({ width: 1600, height: 1008 });

    // SOI, an APP0 segment, then SOF0 with height 720 and width 1280.
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0xd0, 0x05, 0x00, 0x03, 0, 0, 0]);
    expect(imageSize(jpeg)).toEqual({ width: 1280, height: 720 });
  });
});
