import { describe, expect, it } from "vitest";
import { z } from "zod";
import { requiredString } from "./helpers";

describe("requiredString", () => {
  const schema = requiredString(z.string().min(3, "Too short"));

  it("passes through a valid string", () => {
    expect(schema.parse("hello")).toBe("hello");
  });

  it("fails a missing field with the schema's own message, not zod's generic one", () => {
    const result = schema.safeParse(undefined);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Too short");
  });

  it("fails a non-string value the same way as a missing one", () => {
    const result = schema.safeParse(123);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Too short");
  });
});
