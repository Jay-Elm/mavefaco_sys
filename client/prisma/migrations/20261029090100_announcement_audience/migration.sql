-- Who an announcement is for: "everyone" (home page and farmer overview, as
-- before), "farmers" (farmer overview only) or "customers" (home page only).
ALTER TABLE "Announcement" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'everyone';
