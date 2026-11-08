-- Photos in Messages, a customer's private GCash QR, and the refund's reference.
ALTER TABLE "Message" ADD COLUMN "imagePath" TEXT;
ALTER TABLE "User" ADD COLUMN "gcashQrPath" TEXT;
ALTER TABLE "Order" ADD COLUMN "refundReference" TEXT;
