-- Outside market data from PSA OpenSTAT (src/lib/psa.ts).
CREATE TABLE "MarketPrice" (
    "id" SERIAL NOT NULL,
    "cropTypeId" INTEGER NOT NULL,
    "area" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "pricePerKg" DOUBLE PRECISION NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketPrice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketProduction" (
    "id" SERIAL NOT NULL,
    "cropTypeId" INTEGER NOT NULL,
    "area" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "tonnes" DOUBLE PRECISION NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketProduction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketPrice_cropTypeId_area_year_month_key" ON "MarketPrice"("cropTypeId", "area", "year", "month");
CREATE UNIQUE INDEX "MarketProduction_cropTypeId_area_year_quarter_key" ON "MarketProduction"("cropTypeId", "area", "year", "quarter");

ALTER TABLE "MarketPrice" ADD CONSTRAINT "MarketPrice_cropTypeId_fkey" FOREIGN KEY ("cropTypeId") REFERENCES "CropType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketProduction" ADD CONSTRAINT "MarketProduction_cropTypeId_fkey" FOREIGN KEY ("cropTypeId") REFERENCES "CropType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
