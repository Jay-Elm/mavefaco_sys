import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getJwtSecret } from "@/lib/auth";
import type { Role } from "@/lib/roles";

let seq = 0;

export async function createUser(overrides: { role?: Role; suspended?: boolean; name?: string } = {}) {
  seq++;
  return prisma.user.create({
    data: {
      name: overrides.name ?? `Test User ${seq}`,
      email: `user${seq}-${Date.now()}@test.local`,
      // Not a real bcrypt hash — route handlers under test authenticate via
      // the session cookie, never the password.
      password: "not-a-real-hash",
      role: overrides.role ?? "customer",
      suspended: overrides.suspended ?? false,
      emailVerifiedAt: new Date(),
    },
  });
}

export async function createProduct(
  farmerId: number,
  overrides: { name?: string; price?: number; stock?: number; approved?: boolean } = {},
) {
  seq++;
  const category = await prisma.category.create({ data: { name: `Category ${seq}` } });
  return prisma.product.create({
    data: {
      name: overrides.name ?? `Product ${seq}`,
      description: "Test product",
      price: overrides.price ?? 50,
      stock: overrides.stock ?? 10,
      approved: overrides.approved ?? true,
      farmerId,
      categoryId: category.id,
    },
  });
}

export type SessionUser = { id: number; email: string; role: string; tokenVersion: number };

/** Builds a request carrying a session cookie signed the same way as issueSessionResponse. */
export function request(
  path: string,
  { method = "GET", body, as }: { method?: string; body?: unknown; as?: SessionUser } = {},
) {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (as) {
    const token = jwt.sign(
      { id: as.id, email: as.email, role: as.role, tokenVersion: as.tokenVersion },
      getJwtSecret(),
      { expiresIn: "1h" },
    );
    headers.set("cookie", `token=${token}`);
  }
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Second argument Next passes to dynamic-segment route handlers. */
export function params<T extends Record<string, string>>(p: T) {
  return { params: Promise.resolve(p) };
}
