import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { createUser } from "@/test-utils/integration/helpers";
import { fakeStorage } from "@/test-utils/integration/storage";

const SECRET = "cron-secret-for-tests";
const DAY = 24 * 60 * 60 * 1000;

const run = (secret: string | null = SECRET) =>
  GET(new NextRequest("http://localhost:3000/api/cron/purge-id-images", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  }));

/** A farmer with a stored ID image, verified `daysAgo` days ago (or still pending). */
async function farmerWithId(daysAgo: number | "pending") {
  const farmer = await createUser({ role: "farmer" });
  return prisma.user.update({
    where: { id: farmer.id },
    data: {
      idImagePath: `${farmer.id}/scan.jpg`,
      verified: daysAgo !== "pending",
      verifiedAt: daysAgo === "pending" ? null : new Date(Date.now() - daysAgo * DAY),
    },
  });
}
const pathOf = async (id: number) => (await prisma.user.findUniqueOrThrow({ where: { id } })).idImagePath;

beforeEach(() => vi.stubEnv("CRON_SECRET", SECRET));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/cron/purge-id-images", () => {
  it("requires the cron secret", async () => {
    fakeStorage();
    expect((await run(null)).status).toBe(401);
    expect((await run("wrong")).status).toBe(401);
  });

  it("deletes ID images verified over 30 days ago and records it, leaving recent and pending ones", async () => {
    const old = await farmerWithId(31);
    const recent = await farmerWithId(5);
    const pending = await farmerWithId("pending");
    const calls = fakeStorage();

    const res = await run();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ purged: 1, failed: 0 });
    expect(calls.flatMap((c) => c.paths ?? [])).toEqual([`${old.id}/scan.jpg`]);
    expect(await pathOf(old.id)).toBeNull();
    expect(await pathOf(recent.id)).not.toBeNull();
    expect(await pathOf(pending.id)).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "AUTO_PURGE_ID_IMAGE", entityId: old.id } })).toBe(1);
  });

  it.each([
    ["storage refuses the delete", false],
    ["the request to storage fails", "network"],
  ] as const)("keeps the record and reports failure when %s, then succeeds on a later run", async (_, outcome) => {
    const failing = await farmerWithId(40);
    const fine = await farmerWithId(40);
    fakeStorage({ deleteOk: (path) => (path.startsWith(`${failing.id}/`) ? outcome : true) });

    const res = await run();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ purged: 1, failed: 1 });
    expect(await pathOf(failing.id)).toBe(`${failing.id}/scan.jpg`); // still on record → retried tomorrow
    expect(await pathOf(fine.id)).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "AUTO_PURGE_ID_IMAGE", entityId: failing.id } })).toBe(0);

    fakeStorage();
    expect(await (await run()).json()).toEqual({ purged: 1, failed: 0 });
    expect(await pathOf(failing.id)).toBeNull();
  });
});
