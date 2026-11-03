-- When an order last changed (status, cancellation), so open pages can tell
-- something happened. Existing orders start at the time of this migration.
ALTER TABLE "Order" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
