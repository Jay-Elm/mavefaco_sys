import { z } from "zod";

// PATCH /api/admin/users/[id] — at least one of these three must be present.
export const adminUserPatchSchema = z
  .object({
    suspended: z.boolean().optional(),
    verified: z.boolean().optional(),
    newPassword: z.string().trim().min(12, "New password must be at least 12 characters").optional(),
  })
  .refine((data) => data.suspended !== undefined || data.verified !== undefined || data.newPassword !== undefined, {
    message: "suspended, verified, or newPassword must be provided",
  });

export type AdminUserPatchInput = z.infer<typeof adminUserPatchSchema>;
