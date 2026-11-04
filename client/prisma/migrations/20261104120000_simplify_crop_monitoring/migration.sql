-- Crop monitoring is simplified: crop types keep only their harvest range
-- (growth stages are gone), and crop logs keep only type, note and date
-- (no severity, no pest list).
ALTER TABLE "CropType" DROP COLUMN "vegetativeDay",
DROP COLUMN "floweringDay",
DROP COLUMN "fruitingDay";

ALTER TABLE "CropLog" DROP COLUMN "severity",
DROP COLUMN "pest";
