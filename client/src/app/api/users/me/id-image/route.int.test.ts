import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { deleteUserAccount } from "@/lib/deleteAccount";
import { createUser, sessionToken, type SessionUser } from "@/test-utils/integration/helpers";
import { fakeStorage } from "@/test-utils/integration/storage";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

const upload = (as: SessionUser) => {
  const form = new FormData();
  form.append("file", new File([PNG], "id.png", { type: "image/png" }));
  return POST(new NextRequest("http://localhost:3000/api/users/me/id-image", {
    method: "POST",
    headers: { cookie: `token=${sessionToken(as)}` },
    body: form,
  }));
};
const withdraw = (as: SessionUser) =>
  DELETE(new NextRequest("http://localhost:3000/api/users/me/id-image", {
    method: "DELETE",
    headers: { cookie: `token=${sessionToken(as)}` },
  }));

async function farmerWithId(path = "old/scan.jpg", verified = true) {
  const farmer = await createUser({ role: "farmer" });
  return prisma.user.update({
    where: { id: farmer.id },
    data: { idImagePath: path, verified, verifiedAt: verified ? new Date() : null },
  });
}
const stored = (id: number) =>
  prisma.user.findUniqueOrThrow({ where: { id }, select: { idImagePath: true, verified: true, verifiedAt: true } });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/users/me/id-image (replacing a submission)", () => {
  it("deletes the previous file and stores the new one, unverified", async () => {
    const farmer = await farmerWithId();
    const calls = fakeStorage();

    expect((await upload(farmer)).status).toBe(200);

    const after = await stored(farmer.id);
    expect(after.idImagePath).toMatch(new RegExp(`^${farmer.id}/\\d+\\.png$`));
    expect(after).toMatchObject({ verified: false, verifiedAt: null });
    expect(calls.filter((c) => c.method === "DELETE").flatMap((c) => c.paths)).toEqual(["old/scan.jpg"]);
  });

  it("keeps the previous submission and discards the new upload if the old file can't be deleted", async () => {
    const farmer = await farmerWithId();
    const calls = fakeStorage({ deleteOk: (path) => path !== "old/scan.jpg" });

    const res = await upload(farmer);

    expect(res.status).toBe(502);
    expect(await stored(farmer.id)).toMatchObject({ idImagePath: "old/scan.jpg", verified: true });
    const deleted = calls.filter((c) => c.method === "DELETE").flatMap((c) => c.paths);
    expect(deleted).toHaveLength(2);
    expect(deleted[1]).toMatch(new RegExp(`^${farmer.id}/\\d+\\.png$`)); // the new upload, rolled back
  });
});

describe("DELETE /api/users/me/id-image (withdrawing)", () => {
  it("forgets the path once storage confirms the delete", async () => {
    const farmer = await farmerWithId("old/scan.jpg", false);
    fakeStorage();

    expect((await withdraw(farmer)).status).toBe(200);
    expect((await stored(farmer.id)).idImagePath).toBeNull();
  });

  it.each([false, "network"] as const)("keeps the path when the delete fails (%s)", async (outcome) => {
    const farmer = await farmerWithId("old/scan.jpg", false);
    fakeStorage({ deleteOk: () => outcome });

    expect((await withdraw(farmer)).status).toBe(502);
    expect((await stored(farmer.id)).idImagePath).toBe("old/scan.jpg");
  });
});

describe("account deletion with a stored ID", () => {
  it("refuses, keeping the account, until the ID image is really deleted", async () => {
    const farmer = await farmerWithId();
    fakeStorage({ deleteOk: () => false });

    expect(await deleteUserAccount(farmer.id)).toMatchObject({ ok: false, status: 502 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: farmer.id } })).deletedAt).toBeNull();

    fakeStorage();
    expect(await deleteUserAccount(farmer.id)).toEqual({ ok: true });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: farmer.id } })).toMatchObject({ idImagePath: null, deletedAt: expect.any(Date) });
  });
});
