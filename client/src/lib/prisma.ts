import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL!;

// Cap per-instance pool size: on Vercel serverless, many concurrent
// function instances can each open their own pool, and an unbounded max
// risks exhausting Postgres's connection limit under load. In production,
// DATABASE_URL should point at a pooled endpoint (e.g. Supabase's pgbouncer
// port, 6543) — this cap bounds this process's own contribution on top of
// that, it isn't a substitute for it.
const pool = new Pool({
  connectionString,
  max: 5,
});

const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
