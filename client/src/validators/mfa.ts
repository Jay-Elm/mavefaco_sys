import { z } from "zod";
import { requiredString } from "./helpers";

// POST /api/auth/mfa/confirm — a fresh TOTP secret has just been shown as a
// QR code; the code must be a plain 6-digit TOTP (a backup code wouldn't
// exist yet, since enrollment isn't confirmed).
export const mfaConfirmSchema = z.object({
  code: requiredString(z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app")),
});

export type MfaConfirmInput = z.infer<typeof mfaConfirmSchema>;

// POST /api/auth/mfa/verify — accepts either a 6-digit TOTP or an
// XXXX-XXXX backup code, so only checks it's non-empty here; the route
// decides which kind it is.
export const mfaVerifySchema = z.object({
  code: requiredString(z.string().trim().min(1, "Enter a verification code")),
});

export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
