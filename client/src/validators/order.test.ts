import { describe, expect, it } from "vitest";
import { orderSchema } from "./order";

describe("orderSchema", () => {
  it("accepts a valid order and defaults payment/delivery method", () => {
    const result = orderSchema.parse({
      items: [{ productId: 1, quantity: 2 }],
    });
    expect(result.paymentMethod).toBe("cod");
    expect(result.deliveryMethod).toBe("pickup");
  });

  it("rejects an empty cart with 'Cart is empty', not a generic array error", () => {
    const result = orderSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Cart is empty");
  });

  it("treats an entirely missing items key the same as an empty cart", () => {
    const result = orderSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Cart is empty");
  });

  it("rejects a zero or negative quantity", () => {
    expect(orderSchema.safeParse({ items: [{ productId: 1, quantity: 0 }] }).success).toBe(
      false,
    );
    expect(orderSchema.safeParse({ items: [{ productId: 1, quantity: -1 }] }).success).toBe(
      false,
    );
  });

  it("rejects an unknown payment or delivery method", () => {
    const result = orderSchema.safeParse({
      items: [{ productId: 1, quantity: 1 }],
      paymentMethod: "crypto",
    });
    expect(result.success).toBe(false);
  });
});
