import { z } from "zod";
import { isSafeUrl } from "@/lib/url";

export const BANNER_COLORS = ["green", "orange", "blue", "purple", "teal"] as const;

const ctaLinkField = z
  .string()
  .trim()
  .nullish()
  .refine((v) => !v || isSafeUrl(v), { message: "CTA link must be a valid URL or site path" });

// POST /api/banners — title is required.
export const bannerCreateSchema = z.object({
  // Preprocess so a missing `title` key gets "Title is required" too, not
  // zod's generic "expected string, received undefined".
  title: z.preprocess(
    (v) => (typeof v === "string" ? v : ""),
    z.string().trim().min(1, "Title is required"),
  ),
  subtitle: z.string().trim().nullish(),
  ctaText: z.string().trim().nullish(),
  ctaLink: ctaLinkField,
  color: z.enum(BANNER_COLORS).catch("green"),
  displayOrder: z.coerce.number().catch(0),
});

export type BannerCreateInput = z.infer<typeof bannerCreateSchema>;

// PUT /api/banners/[id] — every field optional (partial update).
export const bannerUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  subtitle: z.string().trim().nullish(),
  ctaText: z.string().trim().nullish(),
  ctaLink: ctaLinkField,
  color: z.enum(BANNER_COLORS).catch("green").optional(),
  active: z.boolean().optional(),
  displayOrder: z.coerce.number().optional(),
});

export type BannerUpdateInput = z.infer<typeof bannerUpdateSchema>;
