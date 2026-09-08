import { z } from "zod";

// Shared by the register form (client, via zodResolver) and
// POST /api/auth/register (server) — one schema so the two can't drift,
// which they had: the client used zod's built-in email check while the
// server used a hand-rolled regex.
// Preprocessing a missing/wrong-type value down to "" before the real check
// means an absent field fails the same min-length/format check (and gets
// the same message) as an empty one — rather than zod's generic "expected
// string, received undefined" for the missing case only.
const requiredString = (schema: z.ZodString) =>
  z.preprocess((v) => (typeof v === "string" ? v : ""), schema);

export const registerSchema = z.object({
  name: requiredString(z.string().trim().min(2, "Name must be at least 2 characters")),
  email: requiredString(z.string().trim().toLowerCase().email("Enter a valid email address")),
  password: requiredString(z.string().min(12, "Password must be at least 12 characters")),
  role: z.enum(["customer", "farmer"]).default("customer"),
});

// z.input (not z.infer) so `role`, which has a .default(), stays optional
// here — matching what the form actually produces before zodResolver
// applies the default, not what the schema produces after.
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: requiredString(z.string().trim().toLowerCase().email("Enter a valid email address")),
});

export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: requiredString(z.string().min(1, "Reset link is invalid")),
  newPassword: requiredString(z.string().min(12, "Password must be at least 12 characters")),
});

export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
