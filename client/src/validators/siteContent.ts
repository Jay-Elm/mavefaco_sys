import { z } from "zod";
import { MAX, tooLong } from "./limits";
import { isSafeUrl } from "@/lib/url";

// PUT /api/admin/site-content — any subset of these keys; unknown keys are
// dropped by the route rather than rejected, since this mirrors the prior
// "filter to allowedKeys" behavior.
export const siteContentSchema = z.object({
  cooperative_name: z.string().max(MAX.siteShort, tooLong("Cooperative name", MAX.siteShort)).optional(),
  about_text: z.string().max(MAX.siteLong, tooLong("About text", MAX.siteLong)).optional(),
  mission: z.string().max(MAX.siteLong, tooLong("Mission", MAX.siteLong)).optional(),
  vision: z.string().max(MAX.siteLong, tooLong("Vision", MAX.siteLong)).optional(),
  contact_email: z.string().max(MAX.email, tooLong("Contact email", MAX.email)).optional(),
  contact_phone: z.string().max(MAX.siteShort, tooLong("Contact phone", MAX.siteShort)).optional(),
  contact_address: z.string().max(MAX.siteShort, tooLong("Contact address", MAX.siteShort)).optional(),
  facebook_url: z
    .string()
    .max(MAX.url, tooLong("Facebook URL", MAX.url))
    .refine((v) => !v.trim() || isSafeUrl(v), { message: "Facebook URL must be a valid http(s) URL" })
    .optional(),
});

export type SiteContentInput = z.infer<typeof siteContentSchema>;
export const SITE_CONTENT_KEYS = Object.keys(siteContentSchema.shape) as (keyof SiteContentInput)[];
