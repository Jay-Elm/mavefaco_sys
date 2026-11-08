import { describe, expect, it } from "vitest";
import { orderNoteSchema, orderUpdateText, type UpdateContext } from "./orderUpdates";

const ctx = (over: Partial<UpdateContext> = {}): UpdateContext => ({
  orderId: 12, deliveryMethod: "delivery", paymentStatus: "unpaid", byStaff: false, ...over,
});

describe("orderUpdateText", () => {
  it("words each change for the customer", () => {
    expect(orderUpdateText("confirmed", ctx())).toBe("Order #12 was accepted. The farmer is getting it ready.");
    expect(orderUpdateText("shipped", ctx())).toBe("Order #12 is on its way.");
    expect(orderUpdateText("shipped", ctx({ deliveryMethod: "pickup" }))).toBe("Order #12 is ready for pickup.");
    expect(orderUpdateText("delivered", ctx({ deliveryMethod: "pickup" }))).toBe("Order #12 was picked up. Thank you for your order!");
    expect(orderUpdateText("refunded", ctx())).toBe("Your GCash refund for order #12 was sent. Check your GCash app.");
  });

  it("mentions the refund on a cancel only when one is owed", () => {
    expect(orderUpdateText("cancelled", ctx())).toBe("Order #12 was cancelled by the farmer.");
    expect(orderUpdateText("cancelled", ctx({ paymentStatus: "refund_due", byStaff: true }))).toBe(
      "Order #12 was cancelled by the cooperative. Your GCash payment will be sent back to you.",
    );
  });

  it("a rejected payment on a cancelled order means nothing to refund", () => {
    expect(orderUpdateText("payment_rejected", ctx({ orderCancelled: true }))).toBe(
      "No GCash payment for order #12 arrived, so there is nothing to refund.",
    );
  });

  it("adds the note on its own line, named by who wrote it", () => {
    expect(orderUpdateText("shipped", ctx(), "Gate 2")).toBe("Order #12 is on its way.\nNote from the farmer: Gate 2");
    expect(orderUpdateText("reopened", ctx({ byStaff: true }), "Stock found")).toBe(
      "Order #12 was reopened by the cooperative.\nNote from the cooperative: Stock found",
    );
  });
});

describe("orderNoteSchema", () => {
  it("trims, drops empty notes and caps the length", () => {
    expect(orderNoteSchema.parse("  hi  ")).toBe("hi");
    expect(orderNoteSchema.parse("   ")).toBeUndefined();
    expect(orderNoteSchema.parse(undefined)).toBeUndefined();
    expect(orderNoteSchema.safeParse("x".repeat(301)).success).toBe(false);
  });
});
