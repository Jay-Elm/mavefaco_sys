import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma";
import { Pool } from "pg";
import { signalChange } from "./liveSignal";

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

const base =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = base;
}

const WRITES = new Set([
  "create", "createMany", "createManyAndReturn",
  "update", "updateMany", "updateManyAndReturn",
  "upsert", "delete", "deleteMany",
]);

/**
 * The shared client. Every successful write also tells open pages that
 * something changed (src/lib/liveSignal.ts), so they update straight away.
 */
export const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, args, query }) {
        const result = await query(args);
        if (WRITES.has(operation)) signalChange();
        return result;
      },
    },
  },
});
