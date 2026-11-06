-- Where each crop's harvest range comes from, shown to staff on Crop Types.
ALTER TABLE "CropType" ADD COLUMN "source" TEXT;

-- Department of Agriculture figures (days from planting or transplanting to
-- first harvest). DA Bicol = DA Regional Field Office 5, "Guiya sa Pagtanom
-- nin Gulay" (2021), the regional guide for Albay. Crops a staff member has
-- renamed are left alone.
UPDATE "CropType" SET "daysToHarvestMin" = 20, "daysToHarvestMax" = 25,
  "source" = 'DA Bicol, Guiya sa Pagtanom nin Gulay (2021): 20–25 days after transplanting'
  WHERE "name" = 'Pechay';
UPDATE "CropType" SET "daysToHarvestMin" = 20, "daysToHarvestMax" = 25,
  "source" = 'DA Bicol, Guiya sa Pagtanom nin Gulay (2021): 20–25 days after transplanting'
  WHERE "name" = 'Mustasa';
UPDATE "CropType" SET "daysToHarvestMin" = 49, "daysToHarvestMax" = 65,
  "source" = 'DA Bicol, Guiya sa Pagtanom nin Gulay (2021): Sandigan 49–54, Tenderlong 55, XL 6001 60–65 days after planting'
  WHERE "name" = 'Sitaw';
UPDATE "CropType" SET "daysToHarvestMin" = 60, "daysToHarvestMax" = 75,
  "source" = 'DA Bicol, Guiya sa Pagtanom nin Gulay (2021): 60–75 days after planting'
  WHERE "name" = 'Okra';
UPDATE "CropType" SET "daysToHarvestMin" = 60, "daysToHarvestMax" = 65,
  "source" = 'DA Bicol, Guiya sa Pagtanom nin Gulay (2021): Hercules 60–65 days after planting'
  WHERE "name" = 'Patola';
UPDATE "CropType" SET "daysToHarvestMin" = 30, "daysToHarvestMax" = 45,
  "source" = 'DA Bicol, Guiya sa Pagtanom nin Gulay (2021): leaf type 30–45 days after transplanting (iceberg 45–80)'
  WHERE "name" = 'Lettuce';
UPDATE "CropType" SET "daysToHarvestMin" = 60, "daysToHarvestMax" = 75,
  "source" = 'DA Bicol, Guiya sa Pagtanom nin Gulay (2021): 60–75 days after emergence'
  WHERE "name" = 'Ampalaya';
UPDATE "CropType" SET "daysToHarvestMin" = 90, "daysToHarvestMax" = 100,
  "source" = 'DA Bicol, Guiya sa Pagtanom nin Gulay (2021): Tambuli 90–100 days after planting'
  WHERE "name" = 'Upo';
UPDATE "CropType" SET "daysToHarvestMin" = 50, "daysToHarvestMax" = 80,
  "source" = 'DA Bicol (2021): 50–63 days by variety; DA ATI Region 7, Techno Guide on Organic Eggplant Production: 60–80 days after transplanting'
  WHERE "name" = 'Eggplant';
UPDATE "CropType" SET "daysToHarvestMin" = 21, "daysToHarvestMax" = 28,
  "source" = 'DA ATI Region 7, Kangkong techno guide (2020): 3–4 weeks after planting'
  WHERE "name" = 'Kangkong';
UPDATE "CropType" SET "daysToHarvestMin" = 80, "daysToHarvestMax" = 90,
  "source" = 'DA ATI Region 7, Techno Guide on Organic Squash Production: 80–90 days from seeding'
  WHERE "name" = 'Squash';
UPDATE "CropType" SET "daysToHarvestMin" = 80, "daysToHarvestMax" = 90,
  "source" = 'DA ATI Region 7, Techno Guide on Tomato Production: 80–90 days after planting'
  WHERE "name" = 'Tomato';
UPDATE "CropType" SET "daysToHarvestMin" = 60, "daysToHarvestMax" = 75,
  "source" = 'DA Regional Field Office 2, Pepper Production Guide (2017): harvest starts 60–75 days after transplanting'
  WHERE "name" = 'Siling Labuyo';
