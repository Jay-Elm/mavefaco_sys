export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  FARMER: "farmer",
  CUSTOMER: "customer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
