import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email")>();
  return { ...actual, sendEmail: vi.fn(async () => true) };
});

import { POST as confirm } from "./route";
import { PATCH as updateProfile } from "@/app/api/users/me/route";
import { POST as register } from "@/app/api/auth/register/route";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { createUser, freshIp, request, sessionToken, withRowLocked, type SessionUser } from "@/test-utils/integration/helpers";

const PASSWORD = "correct-horse-battery";
const sent = () => vi.mocked(sendEmail).mock.calls.map(([msg]) => msg);

const requestChange = (as: SessionUser, email: string, currentPassword = PASSWORD) =>
  updateProfile(request("/api/users/me", { method: "PATCH", as, body: { email, currentPassword } }));
const confirmWith = (token: string) =>
  confirm(request("/api/auth/confirm-email-change", { method: "POST", headers: freshIp(), body: { token } }));

/** The raw token from the most recent confirmation email sent to `to`. */
function tokenSentTo(to: string) {
  const msg = sent().filter((m) => m.to === to).at(-1);
  const match = msg?.html.match(/confirm-email-change\?token=([0-9a-f]{64})/);
  if (!match) throw new Error(`no confirmation link sent to ${to}`);
  return match[1];
}

beforeEach(() => vi.mocked(sendEmail).mockClear());

describe("requesting an email change (M4)", () => {
  it("doesn't change the email yet: emails a link to the new address and a notice to the current one", async () => {
    const user = await createUser({ password: PASSWORD });

    const res = await requestChange(user, "new@test.local");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ email: user.email, emailChangePending: "new@test.local" });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after).toMatchObject({ email: user.email, tokenVersion: user.tokenVersion });

    expect(sent().map((m) => m.to).sort()).toEqual([user.email, "new@test.local"].sort());
    expect(sent().find((m) => m.to === "new@test.local")!.html).toMatch(/confirm-email-change\?token=/);
    const notice = sent().find((m) => m.to === user.email)!;
    expect(notice.html).toContain("new@test.local");
    expect(notice.html).not.toMatch(/token=/); // the current address can't confirm on the new one's behalf
  });

  it("still requires the current password", async () => {
    const user = await createUser({ password: PASSWORD });

    expect((await requestChange(user, "new@test.local", "wrong-password")).status).toBe(400);
    expect(await prisma.emailChangeToken.count()).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("only the latest request's link works", async () => {
    const user = await createUser({ password: PASSWORD });
    await requestChange(user, "first@test.local");
    const first = tokenSentTo("first@test.local");
    await requestChange(user, "second@test.local");

    expect((await confirmWith(first)).status).toBe(400);
    expect((await confirmWith(tokenSentTo("second@test.local"))).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe("second@test.local");
  });
});

describe("POST /api/auth/confirm-email-change", () => {
  it("switches the email, logs out every session, and tells the previous address", async () => {
    const user = await createUser({ password: PASSWORD });
    const oldSession = sessionToken(user);
    await requestChange(user, "new@test.local");
    const token = tokenSentTo("new@test.local");
    vi.mocked(sendEmail).mockClear();

    const res = await confirmWith(token);

    expect(res.status).toBe(200);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
      email: "new@test.local",
      emailVerifiedAt: expect.any(Date),
      tokenVersion: user.tokenVersion + 1,
    });
    expect(await getActiveAuthUser(request("/api/users/me", { cookies: { token: oldSession } }))).toBeNull();
    expect(sent()).toEqual([expect.objectContaining({ to: user.email })]);
    expect(sent()[0].html).toContain("new@test.local");
  });

  it("works only once", async () => {
    const user = await createUser({ password: PASSWORD });
    await requestChange(user, "new@test.local");
    const token = tokenSentTo("new@test.local");

    expect((await confirmWith(token)).status).toBe(200);
    expect((await confirmWith(token)).status).toBe(400);
  });

  it("applies only once when the link is opened twice at the same moment", async () => {
    const user = await createUser({ password: PASSWORD });
    await requestChange(user, "new@test.local");
    const token = tokenSentTo("new@test.local");
    const record = await prisma.emailChangeToken.findFirstOrThrow();

    const results = await withRowLocked("EmailChangeToken", record.id, 2, () =>
      Promise.all([confirmWith(token), confirmWith(token)]),
    );

    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).tokenVersion).toBe(user.tokenVersion + 1);
  });

  it("rejects an expired link", async () => {
    const user = await createUser({ password: PASSWORD });
    await requestChange(user, "new@test.local");
    await prisma.emailChangeToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    expect((await confirmWith(tokenSentTo("new@test.local"))).status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(user.email);
  });

  it("refuses if the address was taken by another account in the meantime", async () => {
    const user = await createUser({ password: PASSWORD });
    await requestChange(user, "new@test.local");
    await prisma.user.create({ data: { name: "Someone", email: "new@test.local", password: "x" } });

    expect((await confirmWith(tokenSentTo("new@test.local"))).status).toBe(409);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(user.email);
  });

  it("rejects an unknown token", async () => {
    expect((await confirmWith("f".repeat(64))).status).toBe(400);
  });
});

describe("user-chosen names in email HTML (M6)", () => {
  it("are escaped, so a registration can't inject markup into a MaVeFaCo email", async () => {
    const name = '<a href="https://evil.test">Claim your prize</a>';

    const res = await register(
      request("/api/auth/register", {
        method: "POST",
        headers: freshIp(),
        body: { name, email: "victim@test.local", password: PASSWORD, role: "customer" },
      }),
    );

    expect(res.status).toBe(201);
    const html = sent().find((m) => m.to === "victim@test.local")!.html;
    expect(html).not.toContain('<a href="https://evil.test">');
    expect(html).toContain("&lt;a href=&quot;https://evil.test&quot;&gt;Claim your prize&lt;/a&gt;");
  });
});
