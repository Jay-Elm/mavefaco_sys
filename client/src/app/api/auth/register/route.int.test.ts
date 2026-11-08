import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email")>();
  return { ...actual, sendEmail: vi.fn(async () => true) };
});

import { POST as register } from "./route";
import { prisma } from "@/lib/prisma";
import { freshIp, request } from "@/test-utils/integration/helpers";

const signUp = (body: Record<string, unknown>) =>
  register(request("/api/auth/register", { method: "POST", headers: freshIp(), body }));
const base = { name: "Juan dela Cruz", email: "juan@test.local", password: "correct-horse-battery", role: "customer" };

describe("POST /api/auth/register: age and agreement", () => {
  it("refuses a sign-up without the 18-or-older and Terms/Privacy box", async () => {
    for (const acceptTerms of [undefined, false]) {
      const res = await signUp({ ...base, acceptTerms });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/18 or older/);
    }
    expect(await prisma.user.count()).toBe(0);
  });

  it("records when the person agreed", async () => {
    const before = Date.now();
    expect((await signUp({ ...base, acceptTerms: true })).status).toBe(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: base.email } });
    expect(user.termsAcceptedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
});
