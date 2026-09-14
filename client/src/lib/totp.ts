import { authenticator } from "otplib";
import QRCode from "qrcode";

// window:1 accepts the previous/next 30s step too, to absorb small clock
// drift between the server and the user's phone without widening the
// forgery window much.
authenticator.options = { window: 1 };

const ISSUER = "CoopMarket";

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function verifyTotpCode(code: string, secret: string): boolean {
  try {
    return authenticator.check(code, secret);
  } catch {
    // Throws on a malformed (non-numeric/wrong-length) token instead of
    // just returning false — treat that the same as an incorrect code.
    return false;
  }
}

export async function totpQrCodeDataUrl(email: string, secret: string): Promise<string> {
  const uri = authenticator.keyuri(email, ISSUER, secret);
  return QRCode.toDataURL(uri);
}
