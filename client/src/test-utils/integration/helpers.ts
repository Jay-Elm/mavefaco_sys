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

/**
 * Forces a true overlap between concurrent requests: holds a row lock on
 * `table`/`id` (from a separate connection) while `run` fires the requests,
 * waits until `waiters` of them are blocked on that lock — i.e. they've all
 * done their reads and are about to write — then releases it.
 */
export async function withRowLocked<T>(table: string, id: number, waiters: number, run: () => Promise<T>): Promise<T> {
  const { Client } = await import("pg");
  const holder = new Client({ connectionString: process.env.DATABASE_URL });
  await holder.connect();
  try {
    await holder.query("BEGIN");
    await holder.query(`SELECT 1 FROM "${table}" WHERE id = $1 FOR UPDATE`, [id]);
    const pending = run();
    for (let i = 0; i < 200; i++) {
      // Stats views are snapshotted per transaction; refresh before each look.
      await holder.query("SELECT pg_stat_clear_snapshot()");
      const { rows } = await holder.query(
        "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'",
      );
      if (rows[0].n >= waiters) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    await holder.query("COMMIT");
    return await pending;
  } finally {
    await holder.end();
  }
}
