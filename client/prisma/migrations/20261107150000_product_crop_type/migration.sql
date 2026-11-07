-- Which crop a listing sells (src/lib/market.ts).
ALTER TABLE "Product" ADD COLUMN "cropTypeId" INTEGER;
CREATE INDEX "Product_cropTypeId_idx" ON "Product"("cropTypeId");
ALTER TABLE "Product" ADD CONSTRAINT "Product_cropTypeId_fkey" FOREIGN KEY ("cropTypeId") REFERENCES "CropType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- By name first (English or Filipino). "Upo" and "Sili" must be whole words.
UPDATE "Product" p SET "cropTypeId" = ct.id FROM "CropType" ct WHERE p."cropTypeId" IS NULL AND ct.name = 'Ampalaya' AND (p.name ILIKE '%ampalaya%' OR p.name ILIKE '%amargoso%' OR p.name ILIKE '%bitter gourd%' OR p.name ILIKE '%bitter melon%');
UPDATE "Product" p SET "cropTypeId" = ct.id FROM "CropType" ct WHERE p."cropTypeId" IS NULL AND ct.name = 'Eggplant' AND (p.name ILIKE '%eggplant%' OR p.name ILIKE '%talong%');
UPDATE "Product" p SET "cropTypeId" = ct.id FROM "CropType" ct WHERE p."cropTypeId" IS NULL AND ct.name = 'Kangkong' AND (p.name ILIKE '%kangkong%' OR p.name ILIKE '%water spinach%' OR p.name ILIKE '%swamp cabbage%');
UPDATE "Product" p SET "cropTypeId" = ct.id FROM "CropType" ct WHERE p."cropTypeId" IS NULL AND ct.name = 'Lettuce' AND (p.name ILIKE '%lettuce%' OR p.name ILIKE '%letsugas%');
UPDATE "Product" p SET "cropTypeId" = ct.id FROM "CropType" ct WHERE p."cropTypeId" IS NULL AND ct.name = 'Mustasa' AND (p.name ILIKE '%mustasa%' OR p.name ILIKE '%mustard%');
UPDATE "Product" p SET "cropTypeId" = ct.id FROM "CropType" ct WHERE p."cropTypeId" IS NULL AND ct.name = 'Okra' AND (p.name ~* '\mokra\M');
UPDATE "Product" p SET "cropTypeId" = ct.id FROM "CropType" ct WHERE p."cropTypeId" IS NULL AND ct.name = 'Patola' AND (p.name ILIKE '%patola%' OR p.name ILIKE '%sponge gourd%' OR p.name ILIKE '%luffa%');
UPDATE "Product" p SET "cropTypeId" = ct.id FROM "CropType" ct WHERE p."cropTypeId" IS NULL AND ct.name = 'Pechay' AND (p.name ILIKE '%pechay%' OR p.name ILIKE '%petsay%' OR p.name ILIKE '%bok choy%' OR p.name ILIKE '%pak choi%');
UPDATE "Product" p SET "cropTypeId" = ct.id FROM "CropType" ct WHERE p."cropTypeId" IS NULL AND ct.name = 'Siling Labuyo' AND (p.name ILIKE '%siling labuyo%' OR p.name ILIKE '%labuyo%' OR p.name ILIKE '%chili%' OR p.name ILIKE '%chilli%' OR p.name ~* '\msili\M');
UPDATE "Product" p SET "cropTypeId" = ct.id FROM "CropType" ct WHERE p."cropTypeId" IS NULL AND ct.name = 'Sitaw' AND (p.name ILIKE '%sitaw%' OR p.name ILIKE '%string bean%' OR p.name ILIKE '%yardlong%' OR p.name ILIKE '%balatong%');
UPDATE "Product" p SET "cropTypeId" = ct.id FROM "CropType" ct WHERE p."cropTypeId" IS NULL AND ct.name = 'Squash' AND (p.name ILIKE '%squash%' OR p.name ILIKE '%kalabasa%' OR p.name ILIKE '%karabasa%');
UPDATE "Product" p SET "cropTypeId" = ct.id FROM "CropType" ct WHERE p."cropTypeId" IS NULL AND ct.name = 'Tomato' AND (p.name ILIKE '%tomato%' OR p.name ILIKE '%kamatis%');
UPDATE "Product" p SET "cropTypeId" = ct.id FROM "CropType" ct WHERE p."cropTypeId" IS NULL AND ct.name = 'Upo' AND (p.name ~* '\mupo\M' OR p.name ILIKE '%bottle gourd%');

-- Then a listing no name matched takes the crop of the latest planting sold under it.
UPDATE "Product" p SET "cropTypeId" = pl."cropTypeId"
FROM (SELECT DISTINCT ON ("productId") "productId", "cropTypeId" FROM "Planting" WHERE "productId" IS NOT NULL ORDER BY "productId", "plantedOn" DESC, id DESC) pl
WHERE pl."productId" = p.id AND p."cropTypeId" IS NULL;
