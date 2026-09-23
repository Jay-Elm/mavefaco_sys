import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth";

describe("registerSchema", () => {
  it("accepts a valid registration and lowercases/trims the email", () => {
    const result = registerSchema.parse({
      name: "Jane Farmer",
      email: "  Jane@Example.com  ",
      password: "correcthorsebattery",
    });
    expect(result.email).toBe("jane@example.com");
    expect(result.role).toBe("customer");
  });

  it("rejects a password under 12 characters", () => {
    const result = registerSchema.safeParse({
      name: "Jane Farmer",
      email: "jane@example.com",
      password: "short1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = registerSchema.safeParse({
      name: "Jane Farmer",
      email: "not-an-email",
      password: "correcthorsebattery",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an entirely missing name with the field's own message, not zod's generic one", () => {
    const result = registerSchema.safeParse({
      email: "jane@example.com",
      password: "correcthorsebattery",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message.includes("at least 2 characters"))).toBe(
      true,
    );
  });

  it("only allows customer or farmer at self-registration, never admin/manager", () => {
    const result = registerSchema.safeParse({
      name: "Jane Farmer",
      email: "jane@example.com",
      password: "correcthorsebattery",
      role: "admin",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials and normalizes the email", () => {
    const result = loginSchema.parse({
      email: "  Jane@Example.com",
      password: "anything",
    });
    expect(result.email).toBe("jane@example.com");
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "jane@example.com", password: "" });
    expect(result.success).toBe(false);
  });
});
