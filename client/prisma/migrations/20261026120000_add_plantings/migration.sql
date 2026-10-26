-- Crop monitoring moves from columns on Product to its own records: a
-- CropType list (approximate growing times) and one Planting per season.
-- Existing crop data on products and their crop logs is carried over.

-- CreateTable
CREATE TABLE "CropType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "daysToHarvestMin" INTEGER NOT NULL,
    "daysToHarvestMax" INTEGER NOT NULL,
    "vegetativeDay" INTEGER NOT NULL,
    "floweringDay" INTEGER,
    "fruitingDay" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CropType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Planting" (
    "id" SERIAL NOT NULL,
    "plantedOn" DATE NOT NULL,
    "harvestStart" DATE NOT NULL,
    "harvestEnd" DATE NOT NULL,
    "areaSqm" DOUBLE PRECISION,
    "expectedYield" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'growing',
    "harvestedOn" DATE,
    "actualYield" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "farmerId" INTEGER NOT NULL,
    "cropTypeId" INTEGER NOT NULL,
    "productId" INTEGER,

    CONSTRAINT "Planting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CropType_name_key" ON "CropType"("name");
CREATE INDEX "Planting_farmerId_status_idx" ON "Planting"("farmerId", "status");
CREATE INDEX "Planting_status_harvestStart_idx" ON "Planting"("status", "harvestStart");
CREATE INDEX "Planting_cropTypeId_idx" ON "Planting"("cropTypeId");
CREATE INDEX "Planting_productId_idx" ON "Planting"("productId");

-- AddForeignKey
ALTER TABLE "Planting" ADD CONSTRAINT "Planting_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Planting" ADD CONSTRAINT "Planting_cropTypeId_fkey" FOREIGN KEY ("cropTypeId") REFERENCES "CropType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Planting" ADD CONSTRAINT "Planting_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Starting crop list. Approximate days from planting (transplanting, for
-- seedlings) to harvest; staff can correct them on Dashboard -> Crop Types.
INSERT INTO "CropType" ("name", "daysToHarvestMin", "daysToHarvestMax", "vegetativeDay", "floweringDay", "fruitingDay") VALUES
    ('Pechay',          30,  45,  7, NULL, NULL),
    ('Mustasa',         30,  45,  7, NULL, NULL),
    ('Kangkong',        25,  35,  7, NULL, NULL),
    ('Lettuce',         45,  60, 10, NULL, NULL),
    ('Tomato',          70,  90, 14,   35,   50),
    ('Eggplant',        70, 100, 14,   40,   55),
    ('Ampalaya',        60,  75, 10,   35,   45),
    ('Sitaw',           50,  65, 10,   35,   45),
    ('Okra',            50,  65, 10,   35,   45),
    ('Squash',          85, 110, 14,   45,   60),
    ('Upo',             60,  75, 10,   40,   50),
    ('Patola',          60,  75, 10,   40,   50),
    ('Siling Labuyo',   80, 110, 14,   50,   65),
    ('Other vegetable', 60,  90, 14, NULL, NULL);

-- One planting for every product that has crop data or crop logs. The crop
-- type is the one whose name appears in the product name (longest match),
-- otherwise "Other vegetable". Timestamps are stored in UTC; dates are taken
-- in Philippine time.
INSERT INTO "Planting" ("plantedOn", "harvestStart", "harvestEnd", "status", "updatedAt", "farmerId", "cropTypeId", "productId")
SELECT
    src.planted,
    COALESCE(src.expected, src.planted + ct."daysToHarvestMin"),
    COALESCE(src.expected + (ct."daysToHarvestMax" - ct."daysToHarvestMin"), src.planted + ct."daysToHarvestMax"),
    CASE WHEN p."growthStage" = 'harvested' THEN 'harvested' ELSE 'growing' END,
    CURRENT_TIMESTAMP,
    p."farmerId",
    ct."id",
    p."id"
FROM "Product" p
CROSS JOIN LATERAL (
    SELECT
        COALESCE(
            p."plantingDate",
            (SELECT MIN(l."createdAt") FROM "CropLog" l WHERE l."productId" = p."id"),
            p."createdAt"
        ) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila' AS planted_ts,
        (p."expectedHarvestDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::date AS expected
) t
CROSS JOIN LATERAL (SELECT t.planted_ts::date AS planted, t.expected) src
CROSS JOIN LATERAL (
    SELECT c.* FROM "CropType" c
    WHERE p."name" ILIKE '%' || c."name" || '%' OR c."name" = 'Other vegetable'
    ORDER BY (c."name" = 'Other vegetable'), LENGTH(c."name") DESC
    LIMIT 1
) ct
WHERE p."plantingDate" IS NOT NULL
   OR p."expectedHarvestDate" IS NOT NULL
   OR p."growthStage" IS NOT NULL
   OR p."readyForHarvest"
   OR EXISTS (SELECT 1 FROM "CropLog" l WHERE l."productId" = p."id");

-- Crop logs move from the product to its planting.
ALTER TABLE "CropLog" ADD COLUMN "observedOn" DATE,
ADD COLUMN "pest" TEXT,
ADD COLUMN "plantingId" INTEGER,
ADD COLUMN "severity" TEXT;

UPDATE "CropLog" l
SET "plantingId" = pl."id",
    "observedOn" = (l."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::date
FROM "Planting" pl
WHERE pl."productId" = l."productId";

ALTER TABLE "CropLog" DROP CONSTRAINT IF EXISTS "CropLog_productId_fkey";
DROP INDEX IF EXISTS "CropLog_productId_idx";
DROP INDEX IF EXISTS "CropLog_createdAt_idx";
ALTER TABLE "CropLog" DROP COLUMN "productId",
ALTER COLUMN "observedOn" SET NOT NULL,
ALTER COLUMN "plantingId" SET NOT NULL;

CREATE INDEX "CropLog_plantingId_idx" ON "CropLog"("plantingId");
CREATE INDEX "CropLog_observedOn_idx" ON "CropLog"("observedOn");
ALTER TABLE "CropLog" ADD CONSTRAINT "CropLog_plantingId_fkey" FOREIGN KEY ("plantingId") REFERENCES "Planting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The crop columns on Product are replaced by Planting.
ALTER TABLE "Product" DROP COLUMN "expectedHarvestDate",
DROP COLUMN "growthStage",
DROP COLUMN "plantingDate",
DROP COLUMN "readyForHarvest";
