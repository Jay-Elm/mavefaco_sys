-- Growing times for 13 more crops, from Department of Agriculture production
-- guides and PhilRice (days from planting, sowing or transplanting to first
-- harvest; the source says which). Only crops still without a growing time
-- are filled, so figures staff entered are kept.
UPDATE "CropType" SET "daysToHarvestMin" = 55, "daysToHarvestMax" = 60,
  "source" = 'DA Regional Field Office 2, Cabbage Production Guide: heads ready 55–60 days after transplanting'
  WHERE "name" = 'Cabbage' AND "daysToHarvestMin" IS NULL;
UPDATE "CropType" SET "daysToHarvestMin" = 60, "daysToHarvestMax" = 75,
  "source" = 'DA Regional Field Office 2, Pepper Production Guide: harvest starts 60–75 days after transplanting'
  WHERE "name" = 'Bell Pepper' AND "daysToHarvestMin" IS NULL;
UPDATE "CropType" SET "daysToHarvestMin" = 60, "daysToHarvestMax" = 75,
  "source" = 'DA Regional Field Office 2, Pepper Production Guide: harvest starts 60–75 days after transplanting'
  WHERE "name" = 'Siling Haba' AND "daysToHarvestMin" IS NULL;
UPDATE "CropType" SET "daysToHarvestMin" = 95, "daysToHarvestMax" = 120,
  "source" = 'DA Bicol, Guiya sa Pagtanom nin Gulay (2021): Ilocos White 95–100, Batangas Purple 115–120 days after planting'
  WHERE "name" = 'Garlic' AND "daysToHarvestMin" IS NULL;
UPDATE "CropType" SET "daysToHarvestMin" = 300, "daysToHarvestMax" = 330,
  "source" = 'DA Regional Field Office 2, Ubi Production Guide: 10–11 months after planting (early harvest possible at 6–7 months)'
  WHERE "name" = 'Ube' AND "daysToHarvestMin" IS NULL;
UPDATE "CropType" SET "daysToHarvestMin" = 90, "daysToHarvestMax" = 120,
  "source" = 'DA Regional Field Office 2, Sweet Potato Production Guide: recommended varieties harvested 3–4 months after planting'
  WHERE "name" = 'Camote' AND "daysToHarvestMin" IS NULL;
UPDATE "CropType" SET "daysToHarvestMin" = 75, "daysToHarvestMax" = 90,
  "source" = 'DA Regional Field Office 2, White Potato Production Guide: most potatoes mature 75–90 days after planting'
  WHERE "name" = 'Potato' AND "daysToHarvestMin" IS NULL;
UPDATE "CropType" SET "daysToHarvestMin" = 300, "daysToHarvestMax" = 365,
  "source" = 'DA Regional Field Office 3, Cassava production guide: harvested 10–12 months after planting'
  WHERE "name" = 'Cassava' AND "daysToHarvestMin" IS NULL;
UPDATE "CropType" SET "daysToHarvestMin" = 95, "daysToHarvestMax" = 120,
  "source" = 'DA Regional Field Office 2, Corn Techno Guide: matures 95–120 days after planting, by variety, season and location'
  WHERE "name" = 'Corn' AND "daysToHarvestMin" IS NULL;
UPDATE "CropType" SET "daysToHarvestMin" = 107, "daysToHarvestMax" = 115,
  "source" = 'PhilRice, Top popular rice varieties (2018): Rc 160 107, Rc 216 112, Rc 222 114, Rc 300 115 days after sowing'
  WHERE "name" = 'Palay' AND "daysToHarvestMin" IS NULL;
UPDATE "CropType" SET "daysToHarvestMin" = 42, "daysToHarvestMax" = 56,
  "source" = 'DA, Mga Katutubong Gulay (Indigenous Vegetables) guide, High Value Crops Development Program: young leaves and shoots from 6–8 weeks after planting'
  WHERE "name" = 'Alugbati' AND "daysToHarvestMin" IS NULL;
UPDATE "CropType" SET "daysToHarvestMin" = 42, "daysToHarvestMax" = 56,
  "source" = 'DA, Mga Katutubong Gulay (Indigenous Vegetables) guide, High Value Crops Development Program: harvest starts 6–8 weeks after sowing'
  WHERE "name" = 'Talinum' AND "daysToHarvestMin" IS NULL;
UPDATE "CropType" SET "daysToHarvestMin" = 30, "daysToHarvestMax" = 60,
  "source" = 'DA, Mga Katutubong Gulay (Indigenous Vegetables) guide, High Value Crops Development Program: harvested 30–60 days after planting'
  WHERE "name" = 'Saluyot' AND "daysToHarvestMin" IS NULL;
