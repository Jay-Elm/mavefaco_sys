import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getJwtSecret, verifyToken } from "./auth";

const VALID_SECRET = "a".repeat(32);

describe("getJwtSecret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when JWT_SECRET is missing", () => {
    vi.stubEnv("JWT_SECRET", "");
    expect(() => getJwtSecret()).toThrow(/missing or too short/);
  });

  it("throws when JWT_SECRET is shorter than 32 characters", () => {
    vi.stubEnv("JWT_SECRET", "short-secret");
    expect(() => getJwtSecret()).toThrow(/missing or too short/);
  });

  it("returns the secret when it meets the minimum length", () => {
    vi.stubEnv("JWT_SECRET", VALID_SECRET);
    expect(getJwtSecret()).toBe(VALID_SECRET);
  });
});

describe("verifyToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the payload for a token signed with the current secret", () => {
    vi.stubEnv("JWT_SECRET", VALID_SECRET);
    const token = jwt.sign({ id: 1, email: "a@b.com", role: "customer", tokenVersion: 0 }, VALID_SECRET);
    const payload = verifyToken(token);
    expect(payload?.email).toBe("a@b.com");
  });

  it("returns null for a token signed with a different secret", () => {
    vi.stubEnv("JWT_SECRET", VALID_SECRET);
    const token = jwt.sign({ id: 1, email: "a@b.com", role: "customer", tokenVersion: 0 }, "b".repeat(32));
    expect(verifyToken(token)).toBeNull();
  });

  it("returns null instead of throwing when JWT_SECRET is misconfigured", () => {
    vi.stubEnv("JWT_SECRET", "too-short");
    expect(verifyToken("irrelevant")).toBeNull();
  });

  it("returns null for a garbage token", () => {
    vi.stubEnv("JWT_SECRET", VALID_SECRET);
    expect(verifyToken("not-a-real-token")).toBeNull();
  });
});
