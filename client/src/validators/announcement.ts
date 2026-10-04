import { z } from "zod";
import { MAX, tooLong } from "./limits";
import { requiredString } from "./helpers";

export const ANNOUNCEMENT_TYPES = ["info", "alert", "advisory"] as const;

// POST /api/announcements
export const announcementCreateSchema = z.object({
  title: requiredString(z.string().trim().min(1, "Title is required").max(MAX.announcementTitle, tooLong("Title", MAX.announcementTitle))),
  body: requiredString(z.string().trim().min(1, "Body is required").max(MAX.announcementBody, tooLong("Body", MAX.announcementBody))),
  type: z.enum(ANNOUNCEMENT_TYPES).catch("info"),
});

export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;
