-- AlterTable
ALTER TABLE "User" ADD COLUMN     "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpSecret" TEXT;

-- CreateTable
CREATE TABLE "TotpBackupCode" (
    "id" SERIAL NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "TotpBackupCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TotpBackupCode_userId_idx" ON "TotpBackupCode"("userId");

-- AddForeignKey
ALTER TABLE "TotpBackupCode" ADD CONSTRAINT "TotpBackupCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
