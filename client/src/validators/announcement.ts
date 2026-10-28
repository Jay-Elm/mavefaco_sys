import { z } from "zod";
import { MAX, tooLong } from "./limits";
import { requiredString } from "./helpers";

export const ANNOUNCEMENT_TYPES = ["info", "alert", "advisory"] as const;

// Who sees it: "everyone" on the home page and the farmer overview,
// "farmers" on the farmer overview only, "customers" on the home page only.
export const ANNOUNCEMENT_AUDIENCES = ["everyone", "farmers", "customers"] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

// POST /api/announcements
export const announcementCreateSchema = z.object({
  title: requiredString(z.string().trim().min(1, "Title is required").max(MAX.announcementTitle, tooLong("Title", MAX.announcementTitle))),
  body: requiredString(z.string().trim().min(1, "Body is required").max(MAX.announcementBody, tooLong("Body", MAX.announcementBody))),
  type: z.enum(ANNOUNCEMENT_TYPES).catch("info"),
  // Rejected rather than defaulted when unknown: falling back to "everyone"
  // would publish a farmers-only notice on the public home page.
  audience: z.enum(ANNOUNCEMENT_AUDIENCES, { message: "Choose who the announcement is for" }).default("everyone"),
});

export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;
