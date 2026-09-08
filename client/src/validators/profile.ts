import { z } from "zod";
import { requiredString } from "./helpers";

// PATCH /api/users/me accepts a partial update — any subset of these.
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: requiredString(z.string().min(1, "Current password is required")),
  newPassword: requiredString(z.string().min(12, "New password must be at least 12 characters")),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Changing your email is on its own enough to hijack the account later via
// forgot-password, so it's gated behind re-entering the current password —
// same idea as changePasswordSchema, minus the "set a new one" half.
export const currentPasswordSchema = z.object({
  currentPassword: requiredString(z.string().min(1, "Current password is required")),
});
