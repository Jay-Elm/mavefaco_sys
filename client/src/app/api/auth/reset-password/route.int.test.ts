import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { POST as resetPassword } from "./route";
import { POST as verifyEmail } from "../verify-email/route";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/token";
import { createUser, freshIp, request, withRowLocked } from "@/test-utils/integration/helpers";

const NEW_PASSWORD = "a-brand-new-password";
const HOUR = 60 * 60 * 1000;

const reset = (token: string, newPassword = NEW_PASSWORD) =>
  resetPassword(request("/api/auth/reset-password", { method: "POST", headers: freshIp(), body: { token, newPassword } }));
const verify = (token: string) =>
  verifyEmail(request("/api/auth/verify-email", { method: "POST", headers: freshIp(), body: { token } }));

async function resetLink(userId: number, expiresIn = HOUR) {
  const { raw, hash } = generateToken();
  const record = await prisma.passwordResetToken.create({
    data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + expiresIn) },
  });
  return { raw, id: record.id };
}
async function verificationLink(userId: number, expiresIn = HOUR) {
  const { raw, hash } = generateToken();
  const record = await prisma.emailVerificationToken.create({
    data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + expiresIn) },
  });
  return { raw, id: record.id };
}

describe("POST /api/auth/reset-password", () => {
  it("sets the new password, ends existing sessions, and verifies the email", async () => {
    const user = await createUser({ emailVerified: false });
    const { raw } = await resetLink(user.id);

    expect((await reset(raw)).status).toBe(200);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare(NEW_PASSWORD, after.password)).toBe(true);
    expect(after.tokenVersion).toBe(user.tokenVersion + 1);
    expect(after.emailVerifiedAt).not.toBeNull();
  });

  it("works only once", async () => {
    const user = await createUser();
    const { raw } = await resetLink(user.id);

    expect((await reset(raw)).status).toBe(200);
    expect((await reset(raw, "another-new-password")).status).toBe(400);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare(NEW_PASSWORD, after.password)).toBe(true);
  });

  it("applies only one password when the same link is submitted twice at once", async () => {
    const user = await createUser();
    const { raw, id } = await resetLink(user.id);

    // Both requests find the link unused, then queue on its row to claim it.
    const results = await withRowLocked("PasswordResetToken", id, 2, () =>
      Promise.all([reset(raw, "first-new-password!"), reset(raw, "second-new-password")]),
    );

    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).tokenVersion).toBe(user.tokenVersion + 1);
  });

  it("rejects an expired or unknown link", async () => {
    const user = await createUser();
    const { raw } = await resetLink(user.id, -1000);

    expect((await reset(raw)).status).toBe(400);
    expect((await reset("f".repeat(64))).status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).password).toBe(user.password);
  });

  it("rejects a password under 12 characters", async () => {
    const user = await createUser();
    const { raw } = await resetLink(user.id);

    expect((await reset(raw, "short")).status).toBe(400);
  });
});

describe("POST /api/auth/verify-email", () => {
  it("verifies the email, once", async () => {
    const user = await createUser({ emailVerified: false });
    const { raw } = await verificationLink(user.id);

    expect((await verify(raw)).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).not.toBeNull();
    expect((await verify(raw)).status).toBe(400);
  });

  it("is single-use even when opened twice at the same moment", async () => {
    const user = await createUser({ emailVerified: false });
    const { raw, id } = await verificationLink(user.id);

    const results = await withRowLocked("EmailVerificationToken", id, 2, () => Promise.all([verify(raw), verify(raw)]));

    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
  });

  it("rejects an expired link", async () => {
    const user = await createUser({ emailVerified: false });
    const { raw } = await verificationLink(user.id, -1000);

    expect((await verify(raw)).status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).toBeNull();
  });
});
