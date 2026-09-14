import { z } from "zod";
import { requiredString } from "./helpers";

// POST /api/messages/[userId]
export const messageCreateSchema = z.object({
  content: requiredString(z.string().trim().min(1, "Message cannot be empty")),
});

export type MessageCreateInput = z.infer<typeof messageCreateSchema>;
