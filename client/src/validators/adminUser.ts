import { z } from "zod";

// PATCH /api/admin/users/[id] — at least one of these three must be present.
export const adminUserPatchSchema = z
  .object({
    suspended: z.boolean().optional(),
    verified: z.boolean().optional(),
    newPassword: z.string().trim().min(12, "New password must be at least 12 characters").optional(),
    // Admin-assisted recovery for a locked-out admin/manager (lost device,
    // exhausted backup codes): clears their TOTP enrollment so they go
    // through setup again at next login. Only meaningful for accounts that
    // actually have MFA (admin/manager).
    resetMfa: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.suspended !== undefined ||
      data.verified !== undefined ||
      data.newPassword !== undefined ||
      data.resetMfa !== undefined,
    { message: "suspended, verified, newPassword, or resetMfa must be provided" },
  );

export type AdminUserPatchInput = z.infer<typeof adminUserPatchSchema>;
