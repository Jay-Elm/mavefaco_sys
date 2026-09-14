import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Migrations need a direct (non-pooled) connection: PgBouncer's
  // transaction pooling mode doesn't support the session-level advisory
  // lock Prisma Migrate takes before running DDL, so `migrate deploy`
  // against a pooled URL just hangs instead of failing. The running app
  // (src/lib/prisma.ts) is unaffected by this file — it builds its own
  // pool from DATABASE_URL directly via the pg driver adapter, and that
  // one should stay pointed at the pooler.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
