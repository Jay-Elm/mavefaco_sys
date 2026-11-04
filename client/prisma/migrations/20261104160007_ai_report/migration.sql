-- CreateTable
CREATE TABLE "AiReport" (
    "id" SERIAL NOT NULL,
    "content" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "reportCount" INTEGER NOT NULL,
    "lastLogId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,

    CONSTRAINT "AiReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiReport_createdAt_idx" ON "AiReport"("createdAt");

-- AddForeignKey
ALTER TABLE "AiReport" ADD CONSTRAINT "AiReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
