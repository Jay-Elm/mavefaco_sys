import { z } from "zod";
import { MAX, tooLong } from "./limits";
import { requiredString } from "./helpers";

// POST /api/messages/[userId]
export const messageCreateSchema = z.object({
  content: requiredString(z.string().trim().min(1, "Message cannot be empty").max(MAX.message, tooLong("Message", MAX.message))),
});

export type MessageCreateInput = z.infer<typeof messageCreateSchema>;
