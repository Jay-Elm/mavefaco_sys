import { describe, expect, it, vi } from "vitest";

let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "token" && cookieValue ? { value: cookieValue } : undefined) }),
}));
// cache() memoizes per request in a server render; outside one, call straight through.
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

import { getSessionUser } from "./serverSession";
import { prisma } from "./prisma";
import { createUser, sessionToken } from "@/test-utils/integration/helpers";

describe("getSessionUser (server-rendered pages)", () => {
  it("returns the signed-in user from a valid session cookie", async () => {
    const farmer = await createUser({ role: "farmer", name: "Juan" });
    cookieValue = sessionToken(farmer);

    expect(await getSessionUser()).toEqual({ id: farmer.id, name: "Juan", email: farmer.email, role: "farmer" });
  });

  it("returns null with no cookie, a forged one, a suspended account or a revoked session", async () => {
    cookieValue = undefined;
    expect(await getSessionUser()).toBeNull();

    cookieValue = "not-a-jwt";
    expect(await getSessionUser()).toBeNull();

    const suspended = await createUser({ suspended: true });
    cookieValue = sessionToken(suspended);
    expect(await getSessionUser()).toBeNull();

    const revoked = await createUser();
    cookieValue = sessionToken(revoked);
    await prisma.user.update({ where: { id: revoked.id }, data: { tokenVersion: { increment: 1 } } }); // logout elsewhere
    expect(await getSessionUser()).toBeNull();
  });
});
