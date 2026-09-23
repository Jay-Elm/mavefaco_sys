import { authenticator } from "otplib";
import QRCode from "qrcode";

// window:1 accepts the previous/next 30s step too, to absorb small clock
// drift between the server and the user's phone without widening the
// forgery window much.
authenticator.options = { window: 1 };

const ISSUER = "CoopMarket";
const TOTP_STEP_SECONDS = 30; // matches otplib's default; not overridden above

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Returns the absolute time-step the code matched (for anti-replay
 * tracking against User.totpLastStep), or null if the code is wrong.
 * Checking the delta (rather than just check()'s boolean) is what lets a
 * caller tell *which* step within the window actually matched.
 */
export function verifyTotpCode(code: string, secret: string): number | null {
  try {
    const delta = authenticator.checkDelta(code, secret);
    if (delta === null) return null;
    return Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS) + delta;
  } catch {
    // Throws on a malformed (non-numeric/wrong-length) token instead of
    // just returning null — treat that the same as an incorrect code.
    return null;
  }
}

export async function totpQrCodeDataUrl(email: string, secret: string): Promise<string> {
  const uri = authenticator.keyuri(email, ISSUER, secret);
  return QRCode.toDataURL(uri);
}
