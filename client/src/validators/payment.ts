import { z } from "zod";
import { MAX, tooLong } from "./limits";
import { requiredString } from "./helpers";
import { isSafeUrl } from "@/lib/url";
import { normalizeMobile, normalizeReference } from "@/lib/payment";

const gcashNameField = requiredString(
  z.string().trim().min(2, "Enter the name on the GCash account").max(MAX.name, tooLong("GCash name", MAX.name)),
);

const mobileField = (what: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (normalizeMobile(v) ?? v) : ""),
    z.string().regex(/^09\d{9}$/, `Enter ${what} as an 11-digit mobile number, e.g. 0917 123 4567`),
  );

// PUT /api/users/me/gcash
export const gcashSettingsSchema = z.object({
  name: gcashNameField,
  number: mobileField("the GCash number"),
  // Farmers only (a QR code customers can scan); the route ignores it for customers.
  qrUrl: z
    .string()
    .trim()
    .max(MAX.url, tooLong("QR image URL", MAX.url))
    .nullish()
    .refine((v) => !v || isSafeUrl(v), { message: "QR image URL must be a valid URL" }),
});

// PUT /api/users/me/location — the Philippines lies within these bounds.
export const deliveryLocationSchema = z.object({
  lat: z.number({ error: "Set a pin on the map" }).min(4.5).max(21.5),
  lng: z.number({ error: "Set a pin on the map" }).min(116).max(127),
  address: requiredString(
    z.string().trim().min(5, "Add the house number, street, barangay or a landmark").max(MAX.address, tooLong("Address details", MAX.address)),
  ),
});

// POST /api/customer/orders/[id]/payment
export const paymentSubmitSchema = z.object({
  reference: z.preprocess(
    (v) => (typeof v === "string" ? (normalizeReference(v) ?? v) : ""),
    z.string().regex(/^\d{13}$/, "The GCash reference number has 13 digits"),
  ),
  payerName: gcashNameField,
  payerNumber: mobileField("the number you paid from"),
});

// POST /api/farmer/orders/[id]/payment
export const farmerPaymentActionSchema = z.object({
  action: z.enum(["confirm", "reject", "refunded"], { error: "Unknown payment action" }),
});
