import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));

import jwt from "jsonwebtoken";
import type { NextRequest, NextResponse } from "next/server";
import { authenticator } from "otplib";
import { POST as login } from "../login/route";
import { POST as setup } from "./setup/route";
import { POST as confirm } from "./confirm/route";
import { POST as verify } from "./verify/route";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getJwtSecret, verifyToken } from "@/lib/auth";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { MFA_PENDING_COOKIE, signMfaPendingToken, type MfaPurpose } from "@/lib/mfaToken";
import { generateTotpSecret } from "@/lib/totp";
import { encryptTotpSecret } from "@/lib/totpCrypto";
import { generateBackupCodes } from "@/lib/backupCodes";
import { createUser, freshIp, request, withRowLocked } from "@/test-utils/integration/helpers";

const PASSWORD = "correct-horse-battery";

const call = (
  handler: (req: NextRequest) => Promise<NextResponse>,
  path: string,
  pending: string | undefined,
  body: unknown = {},
  ip = freshIp(),
) =>
  handler(
    request(`/api/auth/mfa/${path}`, {
      method: "POST",
      headers: ip,
      body,
      cookies: pending ? { [MFA_PENDING_COOKIE]: pending } : {},
    }),
  );
const pendingFor = (userId: number, purpose: MfaPurpose) => signMfaPendingToken(userId, purpose);

/** An admin with TOTP fully enrolled; returns the plaintext secret and backup codes. */
async function enrolledAdmin() {
  const user = await createUser({ role: "admin", password: PASSWORD });
  const secret = generateTotpSecret();
  const backup = await generateBackupCodes();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true, totpSecret: encryptTotpSecret(secret) },
  });
  await prisma.totpBackupCode.createMany({ data: backup.map(({ hash }) => ({ userId: user.id, codeHash: hash })) });
  return { user, secret, backupCodes: backup.map(({ code }) => code) };
}

beforeEach(() => vi.mocked(sendEmail).mockClear());

describe("first-time enrollment (login → setup → confirm)", () => {
  it("walks a new manager from password to a real session", async () => {
    const manager = await createUser({ role: "manager", password: PASSWORD });

    const loginRes = await login(
      request("/api/auth/login", { method: "POST", headers: freshIp(), body: { email: manager.email, password: PASSWORD } }),
    );
    const pending = loginRes.cookies.get(MFA_PENDING_COOKIE)!.value;

    const setupRes = await call(setup, "setup", pending);
    expect(setupRes.status).toBe(200);
    const { secret, qrCodeDataUrl } = await setupRes.json();
    expect(qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: manager.id } });
    expect(stored.totpEnabled).toBe(false); // not until confirmed
    expect(stored.totpSecret).toBeTruthy();
    expect(stored.totpSecret).not.toContain(secret); // encrypted at rest

    const confirmRes = await call(confirm, "confirm", pending, { code: authenticator.generate(secret) });
    expect(confirmRes.status).toBe(200);
    const body = await confirmRes.json();

    expect(body.backupCodes).toHaveLength(10);
    expect(verifyToken(confirmRes.cookies.get("token")!.value)).toMatchObject({ id: manager.id, role: "manager" });
    expect(confirmRes.headers.get("set-cookie")).toContain(`${MFA_PENDING_COOKIE}=;`);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: manager.id } });
    expect(after.totpEnabled).toBe(true);
    const codes = await prisma.totpBackupCode.findMany({ where: { userId: manager.id } });
    expect(codes).toHaveLength(10);
    expect(codes.map((c) => c.codeHash)).not.toContain(body.backupCodes[0]); // hashed at rest
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: manager.email }));
  });

  it("rejects a wrong confirmation code and stays unenrolled", async () => {
    const admin = await createUser({ role: "admin" });
    const pending = pendingFor(admin.id, "setup");
    await call(setup, "setup", pending);

    const res = await call(confirm, "confirm", pending, { code: "000000" });

    expect(res.status).toBe(401);
    expect(res.cookies.get("token")).toBeUndefined();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).totpEnabled).toBe(false);
  });

  it("requires /setup before /confirm", async () => {
    const admin = await createUser({ role: "admin" });

    expect((await call(confirm, "confirm", pendingFor(admin.id, "setup"), { code: "123456" })).status).toBe(400);
  });

  it("won't let a setup token overwrite an already-enrolled secret", async () => {
    const { user } = await enrolledAdmin();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    expect((await call(setup, "setup", pendingFor(user.id, "setup"))).status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).totpSecret).toBe(before.totpSecret);
  });
});

describe("POST /api/auth/mfa/verify", () => {
  it("completes login with a current TOTP code", async () => {
    const { user, secret } = await enrolledAdmin();

    const res = await call(verify, "verify", pendingFor(user.id, "verify"), { code: authenticator.generate(secret) });

    expect(res.status).toBe(200);
    expect(verifyToken(res.cookies.get("token")!.value)).toMatchObject({ id: user.id, role: "admin" });
  });

  it("refuses to accept the same TOTP code twice (replay)", async () => {
    const { user, secret } = await enrolledAdmin();
    const code = authenticator.generate(secret);
    const pending = pendingFor(user.id, "verify");

    expect((await call(verify, "verify", pending, { code })).status).toBe(200);
    const replay = await call(verify, "verify", pending, { code });

    expect(replay.status).toBe(401);
    expect(replay.cookies.get("token")).toBeUndefined();
  });

  it("accepts each backup code exactly once, case-insensitively", async () => {
    const { user, backupCodes } = await enrolledAdmin();
    const pending = pendingFor(user.id, "verify");

    expect((await call(verify, "verify", pending, { code: ` ${backupCodes[3].toLowerCase()} ` })).status).toBe(200);
    expect((await call(verify, "verify", pending, { code: backupCodes[3] })).status).toBe(401);
    expect(await prisma.totpBackupCode.count({ where: { userId: user.id, usedAt: { not: null } } })).toBe(1);
  });

  it("rejects a wrong code", async () => {
    const { user } = await enrolledAdmin();

    const res = await call(verify, "verify", pendingFor(user.id, "verify"), { code: "000000" });

    expect(res.status).toBe(401);
    expect(res.cookies.get("token")).toBeUndefined();
  });

  it("rejects the code if the account was suspended after the password step", async () => {
    const { user, secret } = await enrolledAdmin();
    const pending = pendingFor(user.id, "verify");
    await prisma.user.update({ where: { id: user.id }, data: { suspended: true } });

    expect((await call(verify, "verify", pending, { code: authenticator.generate(secret) })).status).toBe(401);
  });

  it("rate-limits code guesses to 10 per account and IP", async () => {
    const { user, secret } = await enrolledAdmin();
    const pending = pendingFor(user.id, "verify");
    const ip = freshIp();

    for (let i = 0; i < 10; i++) await call(verify, "verify", pending, { code: "000000" }, ip);

    expect((await call(verify, "verify", pending, { code: authenticator.generate(secret) }, ip)).status).toBe(429);
  }, 30_000); // each wrong code is also bcrypt-compared against all 10 backup codes
});

describe("the MFA-pending token", () => {
  it("is scoped to its purpose", async () => {
    const { user, secret } = await enrolledAdmin();
    const fresh = await createUser({ role: "admin" });

    expect((await call(verify, "verify", pendingFor(user.id, "setup"), { code: authenticator.generate(secret) })).status).toBe(401);
    expect((await call(setup, "setup", pendingFor(fresh.id, "verify"))).status).toBe(401);
    expect((await call(confirm, "confirm", pendingFor(fresh.id, "verify"), { code: "123456" })).status).toBe(401);
  });

  it("is required, and expires", async () => {
    const { user, secret } = await enrolledAdmin();
    const expired = jwt.sign({ id: user.id, purpose: "verify", exp: Math.floor(Date.now() / 1000) - 1 }, getJwtSecret());

    expect((await call(verify, "verify", undefined, { code: authenticator.generate(secret) })).status).toBe(401);
    expect((await call(verify, "verify", expired, { code: authenticator.generate(secret) })).status).toBe(401);
  });

  it("can't be used as a session token", async () => {
    const { user } = await enrolledAdmin();
    const pending = pendingFor(user.id, "verify");

    expect(await getActiveAuthUser(request("/api/users/me", { cookies: { token: pending } }))).toBeNull();
  });
});

// KNOWN BUG: /verify checks "unused" (totpLastStep, backup-code usedAt) and
// then writes it in a separate statement, so two requests carrying the same
// code at the same moment both pass. `it.fails` passes while the bug is
// present; once /verify claims the code with a conditional update, change
// these to plain `it`.
describe("concurrent use of a single code", () => {
  it.fails("lets only one of two simultaneous requests with the same TOTP code through", async () => {
    const { user, secret } = await enrolledAdmin();
    const code = authenticator.generate(secret);
    const pending = pendingFor(user.id, "verify");

    // Both requests read totpLastStep, then queue on the user row to write it.
    const results = await withRowLocked("User", user.id, 2, () =>
      Promise.all([call(verify, "verify", pending, { code }), call(verify, "verify", pending, { code })]),
    );

    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it.fails("lets only one of two simultaneous requests with the same backup code through", async () => {
    const { user, backupCodes } = await enrolledAdmin();
    const pending = pendingFor(user.id, "verify");
    const first = (await prisma.totpBackupCode.findMany({ where: { userId: user.id }, orderBy: { id: "asc" } }))[0];

    // Both requests find the code unused, then queue on its row to mark it used.
    const results = await withRowLocked("TotpBackupCode", first.id, 2, () =>
      Promise.all([
        call(verify, "verify", pending, { code: backupCodes[0] }),
        call(verify, "verify", pending, { code: backupCodes[0] }),
      ]),
    );

    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });
});
