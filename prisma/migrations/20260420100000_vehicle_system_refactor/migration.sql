-- ============================================
-- gogmo 車型系統重構 Migration
-- 安全做法：先建新欄位 → 轉移資料 → 再 DROP 舊欄位
-- ============================================

-- (1) 建立新 enum
CREATE TYPE "VehicleType" AS ENUM ('SEDAN_5', 'SUV_5', 'MPV_7', 'VAN_9', 'CUSTOM');
CREATE TYPE "RequirementLevel" AS ENUM ('EXACT', 'MIN', 'ANY');
CREATE TYPE "PlateType" AS ENUM ('RENTAL', 'TAXI');

-- (2) orders 表：先新增欄位（不 DROP 舊欄位）
ALTER TABLE "orders" ADD COLUMN "vehicleType" "VehicleType";
ALTER TABLE "orders" ADD COLUMN "vehicleRequirement" "RequirementLevel" NOT NULL DEFAULT 'EXACT';
ALTER TABLE "orders" ADD COLUMN "customVehicleNote" TEXT;
ALTER TABLE "orders" ADD COLUMN "allowTaxiPlate" BOOLEAN NOT NULL DEFAULT false;

-- (3) orders 表：資料轉換
-- 規則：
--   any / any_r / pending / NULL  → vehicleType = NULL, requirement = ANY
--   small        → SEDAN_5, EXACT
--   suv          → SUV_5, EXACT
--   van9         → VAN_9, EXACT  (保守做法：舊 van9 都當 9 人座)
UPDATE "orders" SET
  "vehicleType" = NULL,
  "vehicleRequirement" = 'ANY'
WHERE "vehicle" IN ('any', 'any_r', 'pending') OR "vehicle" IS NULL;

UPDATE "orders" SET
  "vehicleType" = 'SEDAN_5',
  "vehicleRequirement" = 'EXACT'
WHERE "vehicle" = 'small';

UPDATE "orders" SET
  "vehicleType" = 'SUV_5',
  "vehicleRequirement" = 'EXACT'
WHERE "vehicle" = 'suv';

UPDATE "orders" SET
  "vehicleType" = 'VAN_9',
  "vehicleRequirement" = 'EXACT'
WHERE "vehicle" = 'van9';

-- (4) orders 表：移除舊欄位
ALTER TABLE "orders" DROP COLUMN "vehicle";

-- (5) drivers 表：先新增欄位
ALTER TABLE "drivers" ADD COLUMN "vehicleType" "VehicleType" NOT NULL DEFAULT 'SEDAN_5';
ALTER TABLE "drivers" ADD COLUMN "plateType" "PlateType" NOT NULL DEFAULT 'RENTAL';

-- (6) drivers 表：資料轉換
-- 規則：
--   small_sedan  → SEDAN_5
--   small_suv    → SUV_5
--   van7         → MPV_7
--   van9         → VAN_9
--   small        → SEDAN_5
--   suv          → SUV_5
UPDATE "drivers" SET "vehicleType" = 'SEDAN_5' WHERE "carType" IN ('small_sedan', 'small');
UPDATE "drivers" SET "vehicleType" = 'SUV_5' WHERE "carType" IN ('small_suv', 'suv');
UPDATE "drivers" SET "vehicleType" = 'MPV_7' WHERE "carType" = 'van7';
UPDATE "drivers" SET "vehicleType" = 'VAN_9' WHERE "carType" = 'van9';
-- 預設 plateType = RENTAL (R 牌)，符合目前所有司機的實際情況

-- (7) drivers 表：移除舊欄位
ALTER TABLE "drivers" DROP COLUMN "carType";

-- (8) driver_pricing 表：使用安全做法（新增 → 轉資料 → DROP → RENAME）
ALTER TABLE "driver_pricing" ADD COLUMN "vehicleType_new" "VehicleType";
UPDATE "driver_pricing" SET "vehicleType_new" = 'SEDAN_5' WHERE "vehicleType" = 'small';
UPDATE "driver_pricing" SET "vehicleType_new" = 'SUV_5' WHERE "vehicleType" = 'suv';
UPDATE "driver_pricing" SET "vehicleType_new" = 'VAN_9' WHERE "vehicleType" = 'van9';
ALTER TABLE "driver_pricing" DROP COLUMN "vehicleType";
ALTER TABLE "driver_pricing" RENAME COLUMN "vehicleType_new" TO "vehicleType";
ALTER TABLE "driver_pricing" ALTER COLUMN "vehicleType" SET NOT NULL;

-- (9) region_price_stats 表：使用安全做法
ALTER TABLE "region_price_stats" ADD COLUMN "vehicleType_new" "VehicleType";
UPDATE "region_price_stats" SET "vehicleType_new" = 'SEDAN_5' WHERE "vehicleType" = 'small';
UPDATE "region_price_stats" SET "vehicleType_new" = 'SUV_5' WHERE "vehicleType" = 'suv';
UPDATE "region_price_stats" SET "vehicleType_new" = 'VAN_9' WHERE "vehicleType" = 'van9';
ALTER TABLE "region_price_stats" DROP COLUMN "vehicleType";
ALTER TABLE "region_price_stats" RENAME COLUMN "vehicleType_new" TO "vehicleType";
-- 此表 vehicleType 仍 nullable，無 SET NOT NULL
