-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "expectedHarvestDate" TIMESTAMP(3),
ADD COLUMN     "growthStage" TEXT,
ADD COLUMN     "plantingDate" TIMESTAMP(3),
ADD COLUMN     "readyForHarvest" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CropLog" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" INTEGER NOT NULL,

    CONSTRAINT "CropLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CropLog" ADD CONSTRAINT "CropLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
