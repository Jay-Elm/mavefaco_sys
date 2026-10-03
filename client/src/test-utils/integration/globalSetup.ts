import { execSync } from "node:child_process";
import { Client } from "pg";
import { getTestDbUrl } from "./testDbUrl";

/** Creates the test database if needed and brings it up to the latest migration. */
export default async function globalSetup() {
  const testUrl = getTestDbUrl();
  const dbName = new URL(testUrl).pathname.replace(/^\//, "");

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (!rowCount) await admin.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end();
  }

  // prisma.config.ts reads DIRECT_URL; dotenv won't override what's set here.
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DIRECT_URL: testUrl, DATABASE_URL: testUrl },
  });
}
