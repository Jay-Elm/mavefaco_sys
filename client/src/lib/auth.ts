import jwt from "jsonwebtoken";

export interface JwtPayload {
  id: number;
  email: string;
  role: string;
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
  } catch (error) {
    return null;
  }
}
