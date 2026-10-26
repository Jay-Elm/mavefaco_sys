import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Client } from "pg";
import { DELETE, POST } from "./route";
import { GET as cron } from "@/app/api/cron/purge-id-images/route";
import { prisma } from "@/lib/prisma";
import { hashIdNumber } from "@/lib/idNumberHash";
import { deleteUserAccount } from "@/lib/deleteAccount";
import { createIdSubmission, createUser, sessionToken, type SessionUser } from "@/test-utils/integration/helpers";
import { fakeStorage } from "@/test-utils/integration/storage";

/** A JPEG header declaring `w` × `h` pixels: all the server reads. */
function jpeg(w: number, h: number) {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff, 0x03, 0, 0, 0]);
}
const photo = (name: string, w = 1600, h = 1000) => new File([jpeg(w, h)], `${name}.jpg`, { type: "image/jpeg" });

type Fields = { idType?: string; idNumber?: string; captureMethod?: string; front?: File | null; back?: File | null; selfie?: File | null };
function submit(as: SessionUser, f: Fields = {}) {
  const form = new FormData();
  form.append("idType", f.idType ?? "umid");
  form.append("idNumber", f.idNumber ?? "0111-1234567-8");
  form.append("captureMethod", f.captureMethod ?? "camera");
  for (const k of ["front", "back", "selfie"] as const) {
    const file = f[k] === undefined ? photo(k) : f[k];
    if (file) form.append(k, file);
  }
  return POST(new NextRequest("http://localhost:3000/api/users/me/id-submission", {
    method: "POST", headers: { cookie: `token=${sessionToken(as)}` }, body: form,
  }));
}
const withdraw = (as: SessionUser) =>
  DELETE(new NextRequest("http://localhost:3000/api/users/me/id-submission", { method: "DELETE", headers: { cookie: `token=${sessionToken(as)}` } }));
const uploads = (calls: { method: string; url: string }[]) => calls.filter((c) => c.method === "POST").map((c) => c.url.split("/id-verification/")[1]);
const deletes = (calls: { paths?: string[] }[]) => calls.flatMap((c) => c.paths ?? []);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/users/me/id-submission", () => {
  it("stores front, back and selfie privately and records the ID without its number", async () => {
    const farmer = await createUser({ role: "farmer" });
    const calls = fakeStorage();

    const res = await submit(farmer);

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ idType: "umid", numberLast4: "5678", status: "pending", captureMethod: "camera" });
    expect(uploads(calls)).toEqual([
      expect.stringMatching(new RegExp(`^${farmer.id}/\\d+-front\\.jpg$`)),
      expect.stringMatching(/-back\.jpg$/),
      expect.stringMatching(/-selfie\.jpg$/),
    ]);
    const row = await prisma.idSubmission.findFirstOrThrow({ where: { userId: farmer.id } });
    expect(row.numberHash).toBe(hashIdNumber("umid", "011112345678"));
    expect(JSON.stringify(row)).not.toContain("011112345678");
  });

  it("needs no back for a passport, but always a selfie", async () => {
    const farmer = await createUser({ role: "farmer" });
    fakeStorage();

    expect((await submit(farmer, { idType: "passport", idNumber: "P1234567A", back: null, selfie: null })).status).toBe(400);
    const res = await submit(farmer, { idType: "passport", idNumber: "P1234567A", back: null });
    expect(res.status).toBe(201);
    expect((await prisma.idSubmission.findFirstOrThrow({ where: { userId: farmer.id } })).backPath).toBeNull();
  });

  it("rejects a missing side, a photo too small to read, a malformed number and an unknown type, storing nothing", async () => {
    const farmer = await createUser({ role: "farmer" });
    const calls = fakeStorage();

    const tooSmall = await submit(farmer, { front: photo("front", 400, 250) });
    expect(tooSmall.status).toBe(400);
    expect((await tooSmall.json()).error).toMatch(/front photo is too small/);
    expect((await submit(farmer, { back: null })).status).toBe(400);
    expect((await submit(farmer, { idNumber: "12" })).status).toBe(400);
    expect((await submit(farmer, { idType: "library_card" })).status).toBe(400);
    expect(uploads(calls)).toEqual([]);
    expect(await prisma.idSubmission.count()).toBe(0);
  });

  it("is for unverified farmers only", async () => {
    fakeStorage();
    expect((await submit(await createUser())).status).toBe(403);
    const verified = await createUser({ role: "farmer" });
    await prisma.user.update({ where: { id: verified.id }, data: { verified: true } });
    expect((await submit(verified)).status).toBe(409);
  });

  it("refuses an ID pending or approved on another account, deleting the new photos; a rejected one doesn't block", async () => {
    const owner = await createUser({ role: "farmer" });
    await createIdSubmission(owner.id, { numberHash: hashIdNumber("umid", "011112345678") });
    const other = await createUser({ role: "farmer" });
    await createIdSubmission(other.id, { numberHash: hashIdNumber("philsys", "123456789012"), status: "rejected", reviewedAt: new Date() });
    const farmer = await createUser({ role: "farmer" });
    const calls = fakeStorage();

    const res = await submit(farmer);

    expect(res.status).toBe(409);
    expect(deletes(calls).sort()).toEqual(uploads(calls).sort());
    expect(await prisma.idSubmission.count({ where: { userId: farmer.id } })).toBe(0);
    expect((await submit(farmer, { idType: "philsys", idNumber: "1234-5678-9012" })).status).toBe(201);
  });

  it("lets only one of two accounts submitting the same ID at the same time through", async () => {
    const [a, b] = await Promise.all([createUser({ role: "farmer" }), createUser({ role: "farmer" })]);
    fakeStorage();

    // Hold the per-number lock the route takes, so both requests are
    // waiting on it, past their uploads and before their check.
    const hash = hashIdNumber("umid", "011112345678");
    const holder = new Client({ connectionString: process.env.DATABASE_URL });
    await holder.connect();
    let results: Response[];
    try {
      await holder.query("SELECT pg_advisory_lock(hashtext($1))", [hash]);
      const pending = Promise.all([submit(a), submit(b)]);
      for (let i = 0; i < 200; i++) {
        await holder.query("SELECT pg_stat_clear_snapshot()");
        const { rows } = await holder.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'");
        if (rows[0].n >= 2) break;
        await new Promise((r) => setTimeout(r, 25));
      }
      await holder.query("SELECT pg_advisory_unlock(hashtext($1))", [hash]);
      results = await pending;
    } finally {
      await holder.end();
    }

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.idSubmission.count({ where: { numberHash: hash } })).toBe(1);
  });

  it("replaces a pending submission, deleting its photos; if storage refuses, the cleanup retries later", async () => {
    const farmer = await createUser({ role: "farmer" });
    const old = await createIdSubmission(farmer.id);
    const calls = fakeStorage({ deleteOk: (path) => path !== old.selfiePath });

    expect((await submit(farmer)).status).toBe(201);

    expect(await prisma.idSubmission.findMany({ where: { userId: farmer.id }, select: { status: true }, orderBy: { id: "asc" } }))
      .toEqual([{ status: "replaced" }, { status: "pending" }]);
    expect(deletes(calls)).toEqual(expect.arrayContaining([old.frontPath, old.selfiePath]));
    // The selfie wasn't deleted, so the replaced submission keeps its paths.
    expect(await prisma.idSubmission.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({ selfiePath: old.selfiePath, imagesPurgedAt: null });

    fakeStorage();
    vi.stubEnv("CRON_SECRET", "s");
    await cron(new NextRequest("http://localhost:3000/api/cron/purge-id-images", { headers: { authorization: "Bearer s" } }));
    expect(await prisma.idSubmission.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({ selfiePath: null, imagesPurgedAt: expect.any(Date) });
  });

  it("deletes what it uploaded when storage fails part-way", async () => {
    const farmer = await createUser({ role: "farmer" });
    const calls = fakeStorage({ uploadOk: false });

    expect((await submit(farmer)).status).toBe(500);
    expect(await prisma.idSubmission.count()).toBe(0);
    expect(uploads(calls)).toHaveLength(1);
  });
});

describe("DELETE /api/users/me/id-submission", () => {
  it("withdraws a pending submission once storage confirms its photos are gone", async () => {
    const farmer = await createUser({ role: "farmer" });
    const sub = await createIdSubmission(farmer.id);

    fakeStorage({ deleteOk: () => false });
    expect((await withdraw(farmer)).status).toBe(502);
    expect(await prisma.idSubmission.count()).toBe(1);

    const calls = fakeStorage();
    expect((await withdraw(farmer)).status).toBe(200);
    expect(deletes(calls)).toEqual([sub.frontPath, sub.backPath, sub.selfiePath]);
    expect(await prisma.idSubmission.count()).toBe(0);
    expect((await withdraw(farmer)).status).toBe(404);
  });
});

describe("account deletion", () => {
  it("deletes every ID photo and submission, and is refused until storage confirms", async () => {
    const farmer = await createUser({ role: "farmer" });
    const a = await createIdSubmission(farmer.id, { status: "rejected", reviewedAt: new Date() });
    const b = await createIdSubmission(farmer.id);

    fakeStorage({ deleteOk: (p) => p !== b.backPath });
    expect(await deleteUserAccount(farmer.id)).toMatchObject({ ok: false, status: 502 });
    expect(await prisma.idSubmission.count()).toBe(2);

    const calls = fakeStorage();
    expect(await deleteUserAccount(farmer.id)).toMatchObject({ ok: true });
    expect(deletes(calls)).toEqual(expect.arrayContaining([a.frontPath, a.selfiePath, b.backPath]));
    expect(await prisma.idSubmission.count()).toBe(0);
  });
});
