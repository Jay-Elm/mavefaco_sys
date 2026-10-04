import { describe, expect, it } from "vitest";
import { MAX } from "./limits";
import { loginSchema, registerSchema } from "./auth";
import { messageCreateSchema } from "./message";
import { productCreateSchema } from "./product";
import { reviewCreateSchema } from "./review";

const text = (n: number) => "x".repeat(n);
const register = { name: "Juan dela Cruz", email: "juan@example.com", password: "correct-horse-battery" };
const product = { name: "Tomatoes", price: 50, stock: 5, categoryId: 1 };

describe("input length limits", () => {
  it("accept values right at the limit and reject one character over", () => {
    expect(registerSchema.safeParse({ ...register, name: text(MAX.name) }).success).toBe(true);
    const tooLong = registerSchema.safeParse({ ...register, name: text(MAX.name + 1) });
    expect(tooLong.success).toBe(false);
    expect(tooLong.error?.issues[0].message).toBe(`Name must be at most ${MAX.name} characters`);

    expect(messageCreateSchema.safeParse({ content: text(MAX.message) }).success).toBe(true);
    expect(messageCreateSchema.safeParse({ content: text(MAX.message + 1) }).success).toBe(false);
    expect(reviewCreateSchema.safeParse({ rating: 5, comment: text(MAX.review + 1) }).success).toBe(false);
  });

  it("reject an over-long product description instead of silently blanking it", () => {
    const parsed = productCreateSchema.safeParse({ ...product, description: text(MAX.productDescription + 1) });
    expect(parsed.success).toBe(false);

    // Missing or non-text description and unit still fall back as before.
    expect(productCreateSchema.parse({ ...product, description: undefined, unit: "" })).toMatchObject({ description: "", unit: "piece" });
  });

  it("cap new passwords but still accept a long existing password at login", () => {
    expect(registerSchema.safeParse({ ...register, password: text(MAX.newPassword + 1) }).success).toBe(false);
    expect(loginSchema.safeParse({ email: register.email, password: text(500) }).success).toBe(true);
  });
});
