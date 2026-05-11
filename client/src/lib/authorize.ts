import { JwtPayload } from "./auth";

export function authorize(user: JwtPayload, allowedRoles: string[]) {
  return allowedRoles.includes(user.role);
}
