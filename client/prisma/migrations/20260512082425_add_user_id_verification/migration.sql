-- AlterTable
ALTER TABLE "User" ADD COLUMN     "idImageUrl" TEXT,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;
