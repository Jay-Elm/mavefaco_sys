import { afterEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { buildCsp } from "@/lib/csp";

const SECRET = "x".repeat(40);
const page = (path = "/") => proxy(new NextRequest(`http://localhost:3000${path}`));
const nonceOf = (csp: string | null) => csp?.match(/'nonce-([^']+)'/)?.[1];

afterEach(() => vi.unstubAllEnvs());

describe("proxy: Content-Security-Policy on pages", () => {
  it("sends an enforced policy with a fresh nonce, and hands the same nonce to rendering", () => {
    const res = page("/products");
    const csp = res.headers.get("content-security-policy");
    const nonce = nonceOf(csp);

    expect(nonce).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
    // NextResponse.next({ request: { headers } }) forwards these to rendering.
    expect(res.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(res.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
    expect(res.headers.get("content-security-policy-report-only")).toBeNull();
  });

  it("uses a different nonce on every request", () => {
    const nonces = new Set(Array.from({ length: 20 }, () => nonceOf(page().headers.get("content-security-policy"))));
    expect(nonces.size).toBe(20);
  });

  it("allows only nonce-carrying scripts in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const csp = page().headers.get("content-security-policy")!;

    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic';/);
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("report-uri /api/csp-report");
  });

  it("adds 'unsafe-eval' only in development, where React needs it", () => {
    expect(buildCsp("n", { dev: true })).toContain("'unsafe-eval'");
    expect(buildCsp("n")).not.toContain("'unsafe-eval'");
  });
});

describe("proxy: /api/admin guard", () => {
  const admin = (token?: string) =>
    proxy(new NextRequest("http://localhost:3000/api/admin/users", { headers: token ? { cookie: `token=${token}` } : {} }));
  const sign = (role: string) => jwt.sign({ id: 1, email: "a@test.local", role, tokenVersion: 0 }, SECRET);

  it("rejects missing sessions and non-staff roles, and passes staff through without a CSP", async () => {
    vi.stubEnv("JWT_SECRET", SECRET);

    expect(admin().status).toBe(401);
    expect(admin(sign("customer")).status).toBe(403);

    const ok = admin(sign("manager"));
    expect(ok.headers.get("x-middleware-next")).toBe("1");
    expect(ok.headers.get("content-security-policy")).toBeNull();
  });
});
