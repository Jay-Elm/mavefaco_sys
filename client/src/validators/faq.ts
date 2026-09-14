import { z } from "zod";
import { requiredString } from "./helpers";

// POST /api/admin/faqs
export const faqCreateSchema = z.object({
  question: requiredString(z.string().trim().min(1, "Question is required")),
  answer: requiredString(z.string().trim().min(1, "Answer is required")),
  displayOrder: z.coerce.number().catch(0),
});

export type FaqCreateInput = z.infer<typeof faqCreateSchema>;
