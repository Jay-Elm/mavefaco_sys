-- Verifying a farmer in person used to leave their pending ID submission
-- open: it stayed in the staff Users badge and, never reviewed, its photos
-- were never purged. Close those as approved, dated when the farmer was
-- verified, so the 30-day purge picks them up. The reviewer isn't recorded.
UPDATE "IdSubmission" s
SET "status" = 'approved',
    "reviewedAt" = COALESCE(u."verifiedInPersonAt", u."verifiedAt", now())
FROM "User" u
WHERE s."userId" = u."id"
  AND s."status" = 'pending'
  AND u."verified" = true;
