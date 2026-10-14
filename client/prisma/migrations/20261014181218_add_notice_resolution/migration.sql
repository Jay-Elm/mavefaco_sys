-- AlterTable
ALTER TABLE "Notice" ADD COLUMN     "resolution" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Notice_productId_idx" ON "Notice"("productId");

-- Backfill: resolve notices whose listing has already moved on.
-- Listing gone (deleted, so productId was cleared) or archived: removed.
UPDATE "Notice" n
SET "resolvedAt" = COALESCE(p."archivedAt", n."createdAt"), "resolution" = 'removed'
FROM "Notice" n2
LEFT JOIN "Product" p ON p."id" = n2."productId"
WHERE n."id" = n2."id" AND (n2."productId" IS NULL OR p."archivedAt" IS NOT NULL);

-- Listing live and no longer suspended, or suspended again since this
-- notice (a newer notice covers that): resubmitted.
UPDATE "Notice" n
SET "resolvedAt" = p."updatedAt", "resolution" = 'resubmitted'
FROM "Product" p
WHERE p."id" = n."productId" AND n."resolvedAt" IS NULL AND p."archivedAt" IS NULL
  AND (p."suspendedAt" IS NULL OR p."suspendedAt" > n."createdAt" + INTERVAL '1 minute');
