import { execSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { Client } from "pg";
import { SEED, e2eDbUrl } from "./db";

/**
 * Creates the end-to-end database if needed, migrates it, empties it, and
 * seeds two farmers (one with GCash, one without), a customer, and a product
 * from each farmer.
 */
export default async function globalSetup() {
  const url = e2eDbUrl();
  const name = new URL(url).pathname.replace(/^\//, "");

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (!rowCount) await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }

  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url } });

  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    const { rows: tables } = await db.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' AND tablename <> 'CropType'`,
    );
    await db.query(`TRUNCATE TABLE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);

    const hash = await bcrypt.hash(SEED.password, 4);
    const user = async (email: string, nameOf: string, role: string, extra: Record<string, unknown> = {}) => {
      const cols = ["email", "name", "password", "role", "emailVerifiedAt", "verified", "verifiedAt", "updatedAt", ...Object.keys(extra)];
      const vals = [email, nameOf, hash, role, new Date(), role === "farmer", role === "farmer" ? new Date() : null, new Date(), ...Object.values(extra)];
      const { rows } = await db.query(
        `INSERT INTO "User" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`,
        vals,
      );
      return rows[0].id as number;
    };

    await user(SEED.customer.email, SEED.customer.name, "customer");
    const farmer = await user(SEED.farmer.email, SEED.farmer.name, "farmer", {
      gcashName: SEED.farmer.gcashName,
      gcashNumber: SEED.farmer.gcashNumber,
    });
    const farmer2 = await user(SEED.farmerNoGcash.email, SEED.farmerNoGcash.name, "farmer");
    await user(SEED.manager.email, SEED.manager.name, "manager", { totpEnabled: true });

    const { rows: cat } = await db.query(`INSERT INTO "Category" (name) VALUES ('Vegetables') RETURNING id`);
    const product = (farmerId: number, productName: string) =>
      db.query(
        `INSERT INTO "Product" (name, description, price, stock, unit, approved, "farmerId", "categoryId", "updatedAt")
         VALUES ($1, 'Grown for end-to-end tests', 80, 50, 'kg', true, $2, $3, now())`,
        [productName, farmerId, cat[0].id],
      );
    await product(farmer, SEED.product);
    await product(farmer2, SEED.productNoGcash);
  } finally {
    await db.end();
  }
}
