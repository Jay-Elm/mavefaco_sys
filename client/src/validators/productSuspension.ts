import { z } from "zod";
import { MAX, tooLong } from "./limits";

/** Days a suspended listing has to be resubmitted before the daily cron removes it. */
export const SUSPENSION_DAYS = 7;

export const SUSPENSION_REASONS = {
  incorrect_price: "Incorrect or unrealistic price",
  misleading_photo: "Photo is missing, unclear or doesn't show the product",
  inaccurate_description: "Name or description is inaccurate or incomplete",
  wrong_category: "Wrong category or unit",
  prohibited_item: "Prohibited or non-agricultural item",
  duplicate_listing: "Duplicate listing",
  other: "Other (see note)",
} as const;

export type SuspensionReason = keyof typeof SUSPENSION_REASONS;

const REASON_KEYS = Object.keys(SUSPENSION_REASONS) as [SuspensionReason, ...SuspensionReason[]];

/** Labels for stored reason keys; an unknown key is shown as-is. */
export function reasonLabels(keys: string[]): string[] {
  return keys.map((k) => SUSPENSION_REASONS[k as SuspensionReason] ?? k);
}

/** When a listing suspended at `suspendedAt` is due for removal. */
export function suspensionDeadline(suspendedAt: Date | string): Date {
  return new Date(new Date(suspendedAt).getTime() + SUSPENSION_DAYS * 24 * 60 * 60 * 1000);
}

// POST /api/admin/products/[id]/suspend
export const productSuspendSchema = z
  .object({
    reasons: z
      .array(z.enum(REASON_KEYS, { message: "Unknown suspension reason" }))
      .min(1, "Choose at least one reason")
      .transform((r) => [...new Set(r)]),
    note: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() : ""),
      z.string().max(MAX.suspensionNote, tooLong("Note", MAX.suspensionNote)),
    ),
  })
  .refine((v) => !v.reasons.includes("other") || v.note.length > 0, {
    message: 'Add a note explaining "Other"',
    path: ["note"],
  });

export type ProductSuspendInput = z.infer<typeof productSuspendSchema>;
