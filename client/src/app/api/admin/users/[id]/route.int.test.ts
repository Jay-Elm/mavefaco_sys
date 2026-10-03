import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));

import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { createUser, params, request, type SessionUser } from "@/test-utils/integration/helpers";

const patch = (as: SessionUser, targetId: number, body: unknown) =>
  PATCH(request(`/api/admin/users/${targetId}`, { method: "PATCH", as, body }), params({ id: String(targetId) }));

/** An admin/manager with MFA fully enrolled, including two backup codes. */
async function enrolled(role: "admin" | "manager") {
  const user = await createUser({ role });
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true, totpSecret: "encrypted-secret", totpLastStep: 123 },
  });
  await prisma.totpBackupCode.createMany({
    data: [{ userId: user.id, codeHash: "h1" }, { userId: user.id, codeHash: "h2" }],
  });
  return prisma.user.findUniqueOrThrow({ where: { id: user.id } });
}

beforeEach(() => vi.mocked(sendEmail).mockClear());

describe("PATCH /api/admin/users/[id] — admin acting on another admin", () => {
  it("can reset their two-factor authentication (lost-device recovery)", async () => {
    const actor = await createUser({ role: "admin" });
    const locked = await enrolled("admin");

    const res = await patch(actor, locked.id, { resetMfa: true });

    expect(res.status).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: locked.id } });
    expect(after).toMatchObject({ totpEnabled: false, totpSecret: null, totpLastStep: null });
    expect(after.tokenVersion).toBe(locked.tokenVersion + 1); // existing sessions revoked
    expect(after.password).toBe(locked.password); // password untouched
    expect(await prisma.totpBackupCode.count({ where: { userId: locked.id } })).toBe(0);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: locked.email }));
    expect(await prisma.auditLog.count({ where: { action: "RESET_MFA", entityId: locked.id, userId: actor.id } })).toBe(1);
  });

  it.each([
    ["reset their password", { newPassword: "a-brand-new-password" }],
    ["suspend them", { suspended: true }],
    ["change their verified flag", { verified: false }],
    ["reset password and MFA together (full takeover)", { resetMfa: true, newPassword: "a-brand-new-password" }],
  ])("cannot %s", async (_, body) => {
    const actor = await createUser({ role: "admin" });
    const target = await enrolled("admin");

    const res = await patch(actor, target.id, body);

    expect(res.status).toBe(403);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).toEqual(target);
    expect(await prisma.totpBackupCode.count({ where: { userId: target.id } })).toBe(2);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/users/[id] — unchanged rules", () => {
  it("an admin can still reset a manager's MFA and password", async () => {
    const admin = await createUser({ role: "admin" });
    const manager = await enrolled("manager");

    expect((await patch(admin, manager.id, { resetMfa: true })).status).toBe(200);
    expect((await patch(admin, manager.id, { newPassword: "a-brand-new-password" })).status).toBe(200);
  });

  it("a manager cannot reset an admin's or another manager's MFA", async () => {
    const manager = await createUser({ role: "manager" });

    expect((await patch(manager, (await enrolled("admin")).id, { resetMfa: true })).status).toBe(403);
    expect((await patch(manager, (await enrolled("manager")).id, { resetMfa: true })).status).toBe(403);
  });

  it("nobody can change their own account through this route", async () => {
    const admin = await enrolled("admin");

    expect((await patch(admin, admin.id, { resetMfa: true })).status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).totpEnabled).toBe(true);
  });

  it("a manager can still suspend a customer", async () => {
    const manager = await createUser({ role: "manager" });
    const customer = await createUser();

    expect((await patch(manager, customer.id, { suspended: true })).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).suspended).toBe(true);
  });
});
