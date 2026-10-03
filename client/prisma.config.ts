import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Migrations need a session-mode connection: PgBouncer's transaction
  // pooling mode doesn't support the session-level advisory lock Prisma
  // Migrate takes before running DDL, so `migrate deploy` against the
  // transaction pooler (port 6543) just hangs instead of failing. In
  // production DIRECT_URL is Supabase's *Session* pooler (port 5432 on
  // the pooler host), not the true direct db.<ref>.supabase.co endpoint,
  // which is IPv6-only and unreachable from local machines and Vercel's
  // build servers. Session mode keeps one server session per client, so
  // the advisory lock still works. Locally it's plain Postgres. The running app
  // (src/lib/prisma.ts) is unaffected by this file — it builds its own
  // pool from DATABASE_URL directly via the pg driver adapter, and that
  // one should stay pointed at the pooler.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
