import { z } from "zod";

// PATCH /api/users/me accepts a partial update — any subset of these.
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(12, "New password must be at least 12 characters"),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
