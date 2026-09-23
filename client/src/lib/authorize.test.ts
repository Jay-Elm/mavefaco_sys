import { describe, expect, it } from "vitest";
import { authorize } from "./authorize";
import { JwtPayload } from "./auth";

function userWithRole(role: string): JwtPayload {
  return { id: 1, email: "a@b.com", role, tokenVersion: 0 };
}

describe("authorize", () => {
  it("allows a role that's in the allowed list", () => {
    expect(authorize(userWithRole("admin"), ["admin", "manager"])).toBe(true);
  });

  it("rejects a role that's not in the allowed list", () => {
    expect(authorize(userWithRole("customer"), ["admin", "manager"])).toBe(false);
  });

  it("rejects when the allowed list is empty", () => {
    expect(authorize(userWithRole("admin"), [])).toBe(false);
  });
});
