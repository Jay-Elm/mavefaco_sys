import { z } from "zod";
import { MAX, tooLong } from "./limits";
import { ID_REJECTION_REASONS, type IdRejectionReason } from "@/lib/idVerification";

const REASON_KEYS = Object.keys(ID_REJECTION_REASONS) as [IdRejectionReason, ...IdRejectionReason[]];

// POST /api/admin/id-submissions/[id]/review
export const idReviewSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve") }),
  z.object({
    decision: z.literal("reject"),
    reasons: z.array(z.enum(REASON_KEYS)).min(1, "Choose at least one reason").max(REASON_KEYS.length),
    note: z.string().trim().max(MAX.suspensionNote, tooLong("Note", MAX.suspensionNote)).optional(),
  }).refine((v) => !v.reasons.includes("other") || !!v.note, { message: "Add a note explaining the other reason", path: ["note"] }),
], { error: () => "Choose approve or reject" });

export type IdReviewInput = z.infer<typeof idReviewSchema>;

/** Labels for stored reason keys; an unknown key is shown as-is. */
export const idReasonLabels = (keys: string[]) => keys.map((k) => ID_REJECTION_REASONS[k as IdRejectionReason] ?? k);
