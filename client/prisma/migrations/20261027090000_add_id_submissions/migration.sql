-- ID verification moves from one image path on User to IdSubmission
-- records (ID type, front, back, selfie, number fingerprint, review
-- outcome). An ID already uploaded becomes a submission of type
-- "unspecified": approved if its farmer is verified, otherwise pending.

-- CreateTable
CREATE TABLE "IdSubmission" (
    "id" SERIAL NOT NULL,
    "idType" TEXT NOT NULL,
    "numberHash" TEXT,
    "numberLast4" TEXT,
    "frontPath" TEXT,
    "backPath" TEXT,
    "selfiePath" TEXT,
    "captureMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rejectionNote" TEXT,
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "imagesPurgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "IdSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdSubmission_userId_status_idx" ON "IdSubmission"("userId", "status");
CREATE INDEX "IdSubmission_numberHash_idx" ON "IdSubmission"("numberHash");
CREATE INDEX "IdSubmission_status_reviewedAt_idx" ON "IdSubmission"("status", "reviewedAt");

-- AddForeignKey
ALTER TABLE "IdSubmission" ADD CONSTRAINT "IdSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Carry existing uploads over. The review time of an approved one is when
-- its farmer was verified, so the 30-day image purge keeps its clock.
INSERT INTO "IdSubmission" ("idType", "frontPath", "captureMethod", "status", "reviewedAt", "createdAt", "userId")
SELECT
    'unspecified',
    u."idImagePath",
    'legacy',
    CASE WHEN u."verified" THEN 'approved' ELSE 'pending' END,
    CASE WHEN u."verified" THEN COALESCE(u."verifiedAt", CURRENT_TIMESTAMP) END,
    u."updatedAt",
    u."id"
FROM "User" u
WHERE u."idImagePath" IS NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "idImagePath",
ADD COLUMN     "verifiedInPersonAt" TIMESTAMP(3);
