import { z } from "zod";
import { MAX, tooLong } from "./limits";
import { requiredString } from "./helpers";

// POST /api/categories
export const categoryCreateSchema = z.object({
  name: requiredString(z.string().trim().min(1, "Name is required").max(MAX.category, tooLong("Name", MAX.category))),
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
