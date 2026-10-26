import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { createIdSubmission, createUser } from "@/test-utils/integration/helpers";
import { fakeStorage } from "@/test-utils/integration/storage";

const SECRET = "cron-secret-for-tests";
const DAY = 24 * 60 * 60 * 1000;

const run = (secret: string | null = SECRET) =>
  GET(new NextRequest("http://localhost:3000/api/cron/purge-id-images", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  }));

/** A farmer's ID submission with three stored images, reviewed `daysAgo` days ago (or still pending). */
async function submission(daysAgo: number | "pending", status = "approved") {
  const farmer = await createUser({ role: "farmer" });
  return createIdSubmission(farmer.id, {
    status: daysAgo === "pending" ? "pending" : status,
    reviewedAt: daysAgo === "pending" ? null : new Date(Date.now() - daysAgo * DAY),
  });
}
const stored = (id: number) =>
  prisma.idSubmission.findUniqueOrThrow({ where: { id }, select: { frontPath: true, backPath: true, selfiePath: true, imagesPurgedAt: true, status: true } });
const allPaths = (s: { frontPath: string | null; backPath: string | null; selfiePath: string | null }) => [s.frontPath, s.backPath, s.selfiePath];

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

  it("deletes every image of submissions reviewed over 30 days ago, approved or rejected, keeping the decision", async () => {
    const approved = await submission(31);
    const rejected = await submission(45, "rejected");
    const recent = await submission(5);
    const pending = await submission("pending");
    const calls = fakeStorage();

    const res = await run();

    expect(await res.json()).toEqual({ purged: 2, failed: 0 });
    expect(calls.flatMap((c) => c.paths ?? []).sort()).toEqual([...allPaths(approved), ...allPaths(rejected)].sort());
    expect(await stored(approved.id)).toMatchObject({ frontPath: null, backPath: null, selfiePath: null, status: "approved", imagesPurgedAt: expect.any(Date) });
    expect(await stored(rejected.id)).toMatchObject({ frontPath: null, status: "rejected" });
    expect((await stored(recent.id)).frontPath).not.toBeNull();
    expect((await stored(pending.id)).frontPath).not.toBeNull(); // staff still need it, however old
    expect(await prisma.auditLog.count({ where: { action: "AUTO_PURGE_ID_IMAGE" } })).toBe(2);
  });

  it("deletes a replaced submission's images straight away", async () => {
    const replaced = await submission(0, "replaced");
    fakeStorage();

    expect(await (await run()).json()).toEqual({ purged: 1, failed: 0 });
    expect((await stored(replaced.id)).imagesPurgedAt).not.toBeNull();
  });

  it.each([
    ["storage refuses the delete", false],
    ["the request to storage fails", "network"],
  ] as const)("keeps every path and reports failure when %s, then succeeds on a later run", async (_, outcome) => {
    const failing = await submission(40);
    const fine = await submission(40);
    // Only the selfie fails: the other two paths must stay on record too.
    fakeStorage({ deleteOk: (path) => (path === failing.selfiePath ? outcome : true) });

    const res = await run();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ purged: 1, failed: 1 });
    expect(await stored(failing.id)).toMatchObject({ frontPath: failing.frontPath, selfiePath: failing.selfiePath, imagesPurgedAt: null });
    expect((await stored(fine.id)).frontPath).toBeNull();

    fakeStorage();
    expect(await (await run()).json()).toEqual({ purged: 1, failed: 0 });
    expect((await stored(failing.id)).frontPath).toBeNull();
  });
});
