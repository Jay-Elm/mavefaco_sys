-- When a person agreed to the Terms of Service and Privacy Policy (and
-- confirmed they are 18 or older) at registration. Existing accounts: null.
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
