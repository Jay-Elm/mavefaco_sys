import { z } from "zod";

export const orderItemSchema = z.object({
  productId: z.number().int(),
  quantity: z.number().positive(),
});

export const PAYMENT_METHODS = ["cod", "gcash", "bank_transfer"] as const;
export const DELIVERY_METHODS = ["pickup", "delivery"] as const;

// POST /api/orders
export const orderSchema = z.object({
  // Preprocess so a missing `items` key fails with "Cart is empty" too,
  // not zod's generic "expected array, received undefined".
  items: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z.array(orderItemSchema).min(1, "Cart is empty"),
  ),
  paymentMethod: z.enum(PAYMENT_METHODS).default("cod"),
  deliveryMethod: z.enum(DELIVERY_METHODS).default("pickup"),
});

export type OrderInput = z.infer<typeof orderSchema>;
