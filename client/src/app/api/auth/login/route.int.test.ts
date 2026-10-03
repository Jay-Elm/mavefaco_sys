import { describe, expect, it } from "vitest";
import { POST } from "./route";
import { POST as logout } from "../logout/route";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { MFA_PENDING_COOKIE } from "@/lib/mfaToken";
import { createUser, freshIp, request } from "@/test-utils/integration/helpers";

const PASSWORD = "correct-horse-battery";

const login = (email: string, password: string, ip = freshIp()) =>
  POST(request("/api/auth/login", { method: "POST", headers: ip, body: { email, password } }));

describe("POST /api/auth/login", () => {
  it("logs a customer straight in with an httpOnly session cookie", async () => {
    const user = await createUser({ password: PASSWORD });

    const res = await login(user.email, PASSWORD);

    expect(res.status).toBe(200);
    expect((await res.json()).user).toMatchObject({ id: user.id, role: "customer" });
    const cookie = res.cookies.get("token");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(verifyToken(cookie!.value)).toMatchObject({ id: user.id, role: "customer", tokenVersion: 0 });
    expect(res.headers.get("set-cookie")).not.toContain(MFA_PENDING_COOKIE);
  });

  it("gives the same answer for a wrong password and an unknown email (no account enumeration)", async () => {
    const user = await createUser({ password: PASSWORD });

    const wrongPassword = await login(user.email, "not-the-password");
    const unknownEmail = await login("nobody@test.local", PASSWORD);

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Invalid credentials" });
      expect(res.cookies.get("token")).toBeUndefined();
    }
  });

  it("only reveals suspension or unverified email once the password is correct", async () => {
    const suspended = await createUser({ password: PASSWORD, suspended: true });
    const unverified = await createUser({ password: PASSWORD, emailVerified: false });

    expect((await login(suspended.email, "wrong")).status).toBe(401);
    expect((await login(unverified.email, "wrong")).status).toBe(401);

    const s = await login(suspended.email, PASSWORD);
    expect(s.status).toBe(403);
    expect(s.cookies.get("token")).toBeUndefined();

    const u = await login(unverified.email, PASSWORD);
    expect(u.status).toBe(403);
    expect((await u.json()).code).toBe("EMAIL_NOT_VERIFIED");
    expect(u.cookies.get("token")).toBeUndefined();
  });

  it.each(["admin", "manager"] as const)(
    "never issues a session to a %s on password alone — only a short-lived MFA-pending cookie",
    async (role) => {
      const notEnrolled = await createUser({ role, password: PASSWORD });
      const enrolled = await createUser({ role, password: PASSWORD });
      await prisma.user.update({ where: { id: enrolled.id }, data: { totpEnabled: true, totpSecret: "x" } });

      const first = await login(notEnrolled.email, PASSWORD);
      expect(await first.json()).toEqual({ mfaSetupRequired: true });

      const second = await login(enrolled.email, PASSWORD);
      expect(await second.json()).toEqual({ mfaRequired: true });

      for (const res of [first, second]) {
        expect(res.status).toBe(200);
        expect(res.cookies.get("token")).toBeUndefined();
        const pending = res.cookies.get(MFA_PENDING_COOKIE);
        expect(pending?.httpOnly).toBe(true);
        expect(pending?.maxAge).toBe(300);
      }
    },
  );

  it("rate-limits to 10 attempts per IP per window", async () => {
    const user = await createUser({ password: PASSWORD });
    const ip = freshIp();

    for (let i = 0; i < 10; i++) expect((await login(user.email, "wrong", ip)).status).toBe(401);

    const blocked = await login(user.email, PASSWORD, ip); // even the right password
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);

    expect((await login(user.email, PASSWORD)).status).toBe(200); // other IPs unaffected
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the session so the same token stops working", async () => {
    const user = await createUser({ password: PASSWORD });
    const token = (await login(user.email, PASSWORD)).cookies.get("token")!.value;
    const withToken = () => request("/api/auth/logout", { method: "POST", cookies: { token } });

    expect(await getActiveAuthUser(withToken())).toMatchObject({ id: user.id });

    const res = await logout(withToken());

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/token=;/);
    expect(await getActiveAuthUser(withToken())).toBeNull();
  });
});
