import { z } from "zod";
import { MAX, tooLong } from "./limits";

// POST /api/products/[id]/reviews
export const reviewCreateSchema = z.object({
  rating: z.number().int().min(1, "Rating must be 1–5").max(5, "Rating must be 1–5"),
  comment: z.string().trim().max(MAX.review, tooLong("Review", MAX.review)).nullish(),
});

export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
