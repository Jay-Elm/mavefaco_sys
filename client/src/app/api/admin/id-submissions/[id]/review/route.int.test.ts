import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email")>();
  return { ...actual, sendEmail: vi.fn(async () => true) };
});

import { POST as review } from "./route";
import { GET as viewSubmission } from "@/app/api/admin/users/[id]/id-submission/route";
import { PATCH as patchUser } from "@/app/api/admin/users/[id]/route";
import { GET as listUsers } from "@/app/api/admin/users/route";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { createIdSubmission, createUser, params, request, type SessionUser } from "@/test-utils/integration/helpers";
import { fakeStorage } from "@/test-utils/integration/storage";

const decide = (submissionId: number, as: SessionUser, body: unknown) =>
  review(request(`/api/admin/id-submissions/${submissionId}/review`, { method: "POST", as, body }), params({ id: String(submissionId) }));
const view = (userId: number, as: SessionUser) =>
  viewSubmission(request(`/api/admin/users/${userId}/id-submission`, { as }), params({ id: String(userId) }));
const patch = (userId: number, as: SessionUser, body: unknown) =>
  patchUser(request(`/api/admin/users/${userId}`, { method: "PATCH", as, body }), params({ id: String(userId) }));
const user = (id: number) => prisma.user.findUniqueOrThrow({ where: { id }, select: { verified: true, verifiedAt: true, verifiedInPersonAt: true } });

beforeEach(() => vi.mocked(sendEmail).mockClear());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/admin/id-submissions/[id]/review", () => {
  it("approving verifies the farmer, with a notice, an email and an audit entry", async () => {
    const farmer = await createUser({ role: "farmer" });
    const sub = await createIdSubmission(farmer.id);
    const manager = await createUser({ role: "manager" });

    const res = await decide(sub.id, manager, { decision: "approve" });

    expect(await res.json()).toMatchObject({ status: "approved", emailSent: true });
    expect(await user(farmer.id)).toMatchObject({ verified: true, verifiedAt: expect.any(Date) });
    expect(await prisma.idSubmission.findUniqueOrThrow({ where: { id: sub.id } })).toMatchObject({ status: "approved", reviewedById: manager.id, reviewedAt: expect.any(Date) });
    expect(await prisma.notice.findFirstOrThrow({ where: { recipientId: farmer.id } })).toMatchObject({ title: "Your ID was approved" });
    expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(expect.objectContaining({ to: farmer.email, subject: "Your MaVeFaCo account is verified" }));
    expect(await prisma.auditLog.count({ where: { action: "APPROVE_ID", entityId: farmer.id, userId: manager.id } })).toBe(1);
  });

  it("rejecting needs reasons (and a note for 'other'), and tells the farmer why", async () => {
    const farmer = await createUser({ role: "farmer" });
    const sub = await createIdSubmission(farmer.id);
    const admin = await createUser({ role: "admin" });

    expect((await decide(sub.id, admin, { decision: "reject", reasons: [] })).status).toBe(400);
    expect((await decide(sub.id, admin, { decision: "reject", reasons: ["other"] })).status).toBe(400);
    const res = await decide(sub.id, admin, { decision: "reject", reasons: ["face_mismatch", "unreadable"], note: "Retake in daylight" });

    expect(res.status).toBe(200);
    expect(await prisma.idSubmission.findUniqueOrThrow({ where: { id: sub.id } })).toMatchObject({
      status: "rejected", rejectionReasons: ["face_mismatch", "unreadable"], rejectionNote: "Retake in daylight",
    });
    expect((await user(farmer.id)).verified).toBe(false);
    const notice = await prisma.notice.findFirstOrThrow({ where: { recipientId: farmer.id } });
    expect(notice.body).toContain("The selfie doesn't match the photo on the ID");
    expect(notice.body).toContain("Retake in daylight");
    const email = vi.mocked(sendEmail).mock.calls[0][0];
    expect(email.html).toContain("A photo is blurry, dark or cut off");
  });

  it("records one decision when reviewed twice", async () => {
    const farmer = await createUser({ role: "farmer" });
    const sub = await createIdSubmission(farmer.id);
    const manager = await createUser({ role: "manager" });

    const results = await Promise.all([
      decide(sub.id, manager, { decision: "approve" }),
      decide(sub.id, manager, { decision: "reject", reasons: ["expired"] }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.notice.count({ where: { recipientId: farmer.id } })).toBe(1);
    expect(vi.mocked(sendEmail)).toHaveBeenCalledTimes(1);
  });

  it("is for staff only", async () => {
    const farmer = await createUser({ role: "farmer" });
    const sub = await createIdSubmission(farmer.id);
    expect((await decide(sub.id, farmer, { decision: "approve" })).status).toBe(403);
    expect((await decide(sub.id, await createUser(), { decision: "approve" })).status).toBe(403);
    expect((await user(farmer.id)).verified).toBe(false);
  });
});

describe("GET /api/admin/users/[id]/id-submission", () => {
  it("shows the pending submission with short-lived links to its photos, and accounts with the same ID number", async () => {
    const farmer = await createUser({ role: "farmer", name: "Ana" });
    await createIdSubmission(farmer.id, { status: "rejected", reviewedAt: new Date(), numberHash: "same" });
    const pending = await createIdSubmission(farmer.id, { numberHash: "same" });
    const other = await createUser({ role: "farmer", name: "Ben" });
    await createIdSubmission(other.id, { status: "rejected", reviewedAt: new Date(), numberHash: "same" });
    fakeStorage();

    const body = await (await view(farmer.id, await createUser({ role: "manager" }))).json();

    expect(body.submission).toMatchObject({ id: pending.id, status: "pending", numberLast4: "5678", captureMethod: "camera" });
    expect(body.submission.images.front).toBe(`https://storage.test/storage/v1/object/sign/id-verification/${pending.frontPath}?token=t`);
    expect(body.submission.images.selfie).toContain(pending.selfiePath);
    expect(body.previousRejections).toBe(1);
    expect(body.sameNumber).toEqual([expect.objectContaining({ name: "Ben", status: "rejected" })]);
    expect(JSON.stringify(body)).not.toContain("numberHash");
  });

  it("is for staff only", async () => {
    const farmer = await createUser({ role: "farmer" });
    await createIdSubmission(farmer.id);
    fakeStorage();
    expect((await view(farmer.id, farmer)).status).toBe(403);
  });
});

describe("PATCH /api/admin/users/[id] verification", () => {
  it("verifies a farmer in person, and revoking clears it", async () => {
    const farmer = await createUser({ role: "farmer" });
    const manager = await createUser({ role: "manager" });

    expect((await patch(farmer.id, manager, { verified: true })).status).toBe(400); // only via review or in person
    expect(await (await patch(farmer.id, manager, { verifiedInPerson: true })).json()).toMatchObject({ verified: true, verifiedInPersonAt: expect.any(String) });
    expect(await prisma.auditLog.count({ where: { action: "VERIFY_IN_PERSON", entityId: farmer.id } })).toBe(1);

    await patch(farmer.id, manager, { verified: false });
    expect(await user(farmer.id)).toEqual({ verified: false, verifiedAt: null, verifiedInPersonAt: null });
  });

  it("only applies to farmers", async () => {
    const customer = await createUser();
    expect((await patch(customer.id, await createUser({ role: "admin" }), { verifiedInPerson: true })).status).toBe(400);
  });

  it("the user list shows each farmer's latest ID status", async () => {
    const pending = await createUser({ role: "farmer" });
    await createIdSubmission(pending.id, { status: "replaced", reviewedAt: new Date() });
    await createIdSubmission(pending.id);
    const none = await createUser({ role: "farmer" });

    const rows: { id: number; idStatus: string | null }[] = await (await listUsers(request("/api/admin/users", { as: await createUser({ role: "admin" }) }))).json();

    expect(rows.find((r) => r.id === pending.id)?.idStatus).toBe("pending");
    expect(rows.find((r) => r.id === none.id)?.idStatus).toBeNull();
  });
});
