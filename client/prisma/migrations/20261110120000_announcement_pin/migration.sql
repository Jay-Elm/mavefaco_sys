-- Staff can pin an announcement: pinned ones are shown first (newest pin
-- first) wherever their audience sees announcements.
ALTER TABLE "Announcement" ADD COLUMN "pinnedAt" TIMESTAMP(3);
