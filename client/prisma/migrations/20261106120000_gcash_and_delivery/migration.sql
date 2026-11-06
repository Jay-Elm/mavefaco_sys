-- GCash details and a saved delivery spot on accounts
ALTER TABLE "User" ADD COLUMN "gcashName" TEXT,
ADD COLUMN "gcashNumber" TEXT,
ADD COLUMN "gcashQrUrl" TEXT,
ADD COLUMN "deliveryLat" DOUBLE PRECISION,
ADD COLUMN "deliveryLng" DOUBLE PRECISION,
ADD COLUMN "deliveryAddress" TEXT,
ADD COLUMN "deliveryTown" TEXT;

-- Payment tracking and the delivery spot on orders
ALTER TABLE "Order" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
ADD COLUMN "gcashReference" TEXT,
ADD COLUMN "payerName" TEXT,
ADD COLUMN "payerNumber" TEXT,
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "deliveryLat" DOUBLE PRECISION,
ADD COLUMN "deliveryLng" DOUBLE PRECISION,
ADD COLUMN "deliveryAddress" TEXT,
ADD COLUMN "deliveryTown" TEXT;

CREATE UNIQUE INDEX "Order_gcashReference_key" ON "Order"("gcashReference");
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");
