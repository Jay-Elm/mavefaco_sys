import { z } from "zod";

// POST /api/products/[id]/reviews
export const reviewCreateSchema = z.object({
  rating: z.number().int().min(1, "Rating must be 1–5").max(5, "Rating must be 1–5"),
  comment: z.string().trim().nullish(),
});

export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
