import { NextRequest } from "next/server";
import { verifyToken, JwtPayload } from "./auth";

export function getAuthUser(req: NextRequest): JwtPayload | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  if (!token) return null;
  return verifyToken(token);
}
