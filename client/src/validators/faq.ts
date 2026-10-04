import { z } from "zod";
import { MAX, tooLong } from "./limits";
import { requiredString } from "./helpers";

// POST /api/admin/faqs
export const faqCreateSchema = z.object({
  question: requiredString(z.string().trim().min(1, "Question is required").max(MAX.faqQuestion, tooLong("Question", MAX.faqQuestion))),
  answer: requiredString(z.string().trim().min(1, "Answer is required").max(MAX.faqAnswer, tooLong("Answer", MAX.faqAnswer))),
  displayOrder: z.coerce.number().catch(0),
});

export type FaqCreateInput = z.infer<typeof faqCreateSchema>;
