import { getTestDbUrl } from "./testDbUrl";

// Runs before setup.ts imports @/lib/prisma, which reads DATABASE_URL at load time.
process.env.DATABASE_URL = getTestDbUrl();
process.env.JWT_SECRET = "integration-test-secret-not-used-anywhere-else";
