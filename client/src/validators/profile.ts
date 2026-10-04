import { z } from "zod";
import { MAX, tooLong } from "./limits";
import { requiredString } from "./helpers";

// PATCH /api/users/me accepts a partial update — any subset of these.
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(MAX.name, tooLong("Name", MAX.name)).optional(),
  email: z.string().trim().toLowerCase().max(MAX.email, tooLong("Email", MAX.email)).email("Enter a valid email address").optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: requiredString(z.string().min(1, "Current password is required").max(MAX.password, tooLong("Password", MAX.password))),
  newPassword: requiredString(z.string().min(12, "New password must be at least 12 characters").max(MAX.newPassword, tooLong("New password", MAX.newPassword))),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Changing your email is on its own enough to hijack the account later via
// forgot-password, so it's gated behind re-entering the current password —
// same idea as changePasswordSchema, minus the "set a new one" half.
export const currentPasswordSchema = z.object({
  currentPassword: requiredString(z.string().min(1, "Current password is required").max(MAX.password, tooLong("Password", MAX.password))),
});
