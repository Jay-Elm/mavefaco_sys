-- AlterTable
ALTER TABLE "User" ADD COLUMN "verifiedAt" TIMESTAMP(3);

-- Backfill: accounts already verified before this column existed get
-- "now" as their verification time rather than staying null forever.
-- This starts the auto-purge retention clock (see
-- /api/cron/purge-id-images) for them from deploy time instead of never
-- firing.
UPDATE "User" SET "verifiedAt" = NOW() WHERE "verified" = true AND "verifiedAt" IS NULL;
