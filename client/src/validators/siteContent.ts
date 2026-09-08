import { z } from "zod";
import { isSafeUrl } from "@/lib/url";

// PUT /api/admin/site-content — any subset of these keys; unknown keys are
// dropped by the route rather than rejected, since this mirrors the prior
// "filter to allowedKeys" behavior.
export const siteContentSchema = z.object({
  cooperative_name: z.string().optional(),
  about_text: z.string().optional(),
  mission: z.string().optional(),
  vision: z.string().optional(),
  contact_email: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_address: z.string().optional(),
  facebook_url: z
    .string()
    .refine((v) => !v.trim() || isSafeUrl(v), { message: "Facebook URL must be a valid http(s) URL" })
    .optional(),
});

export type SiteContentInput = z.infer<typeof siteContentSchema>;
export const SITE_CONTENT_KEYS = Object.keys(siteContentSchema.shape) as (keyof SiteContentInput)[];
