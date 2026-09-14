import jwt from "jsonwebtoken";

export interface JwtPayload {
  id: number;
  email: string;
  role: string;
  tokenVersion: number;
}

const MIN_SECRET_LENGTH = 32;

// A short/weak JWT_SECRET is a silent full-auth-bypass risk (HS256 signatures
// become brute-forceable) — fail loud at first use instead of letting a weak
// or missing secret sign/verify tokens unnoticed.
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET is missing or too short (must be at least ${MIN_SECRET_LENGTH} characters). Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`,
    );
  }
  return secret;
}

export function verifyToken(token: string): JwtPayload | null {
  let secret: string;
  try {
    secret = getJwtSecret();
  } catch (error) {
    // Server misconfiguration, not an invalid token — log it so it's
    // visible in server logs instead of looking like every user's
    // session silently expired.
    console.error(error);
    return null;
  }

  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    return null;
  }
}
