-- Automatic "Order update" messages to the customer, tied to their order.
ALTER TABLE "Message" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "Message" ADD COLUMN "orderId" INTEGER;
ALTER TABLE "Message" ADD CONSTRAINT "Message_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The customer's "updated" dot on My Orders. Existing orders count as seen.
ALTER TABLE "Order" ADD COLUMN "customerNotifiedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "customerSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
