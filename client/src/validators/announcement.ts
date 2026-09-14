import { z } from "zod";
import { requiredString } from "./helpers";

export const ANNOUNCEMENT_TYPES = ["info", "alert", "advisory"] as const;

// POST /api/announcements
export const announcementCreateSchema = z.object({
  title: requiredString(z.string().trim().min(1, "Title is required")),
  body: requiredString(z.string().trim().min(1, "Body is required")),
  type: z.enum(ANNOUNCEMENT_TYPES).catch("info"),
});

export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;
