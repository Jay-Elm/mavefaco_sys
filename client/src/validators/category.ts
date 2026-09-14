import { z } from "zod";
import { requiredString } from "./helpers";

// POST /api/categories
export const categoryCreateSchema = z.object({
  name: requiredString(z.string().trim().min(1, "Name is required")),
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
