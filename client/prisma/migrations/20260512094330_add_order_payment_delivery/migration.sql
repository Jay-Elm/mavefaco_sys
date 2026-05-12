-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryMethod" TEXT NOT NULL DEFAULT 'pickup',
ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'cod';
