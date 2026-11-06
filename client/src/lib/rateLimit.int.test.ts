import { describe, expect, it } from "vitest";
import { memoryRateLimit, rateLimit } from "./rateLimit";
import { prisma } from "@/lib/prisma";

describe("rateLimit (shared, in Postgres)", () => {
  it("allows up to the limit, then refuses with a wait", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit("test:a", 3, 60_000));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3].retryAfterSeconds).toBeGreaterThan(50);
    expect(results[3].retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("counts every caller against one limit, even all at once", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => rateLimit("test:burst", 4, 60_000)));
    expect(results.filter((r) => r.allowed)).toHaveLength(4);
    expect((await prisma.rateLimit.findUniqueOrThrow({ where: { key: "test:burst" } })).count).toBe(10);
  });

  it("keeps keys apart", async () => {
    await rateLimit("test:x", 1, 60_000);
    expect((await rateLimit("test:x", 1, 60_000)).allowed).toBe(false);
    expect((await rateLimit("test:y", 1, 60_000)).allowed).toBe(true);
  });

  it("starts again once the window ends", async () => {
    await rateLimit("test:w", 1, 60_000);
    expect((await rateLimit("test:w", 1, 60_000)).allowed).toBe(false);
    await prisma.rateLimit.update({ where: { key: "test:w" }, data: { resetAt: new Date(Date.now() - 1000) } });
    expect((await rateLimit("test:w", 1, 60_000)).allowed).toBe(true);
  });
});

describe("memoryRateLimit (fallback)", () => {
  it("allows up to the limit per key", () => {
    const r = Array.from({ length: 3 }, () => memoryRateLimit("mem:a", 2, 60_000));
    expect(r.map((x) => x.allowed)).toEqual([true, true, false]);
  });
});
