import { getTestDbUrl } from "./testDbUrl";

// Runs before setup.ts imports @/lib/prisma, which reads DATABASE_URL at load time.
process.env.DATABASE_URL = getTestDbUrl();
process.env.JWT_SECRET = "integration-test-secret-not-used-anywhere-else";
// Never send real email from tests, even if a route's sendEmail isn't mocked.
delete process.env.BREVO_API_KEY;
// Tests choose their own MFA encryption keys; start from the legacy (JWT-derived) key.
delete process.env.TOTP_ENCRYPTION_KEY;
delete process.env.TOTP_ENCRYPTION_KEY_PREVIOUS;
