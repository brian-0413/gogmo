-- Migration 1: gogmo v1.2 Phase 1 Schema
-- Includes: DispatcherTier/VerificationStatus enums, User quota & verification fields, Order surge fields, Dispatcher preferences
-- Note: DispatcherPreference is in a separate migration

-- Step 1: Create enums
CREATE TYPE "DispatcherTier" AS ENUM ('BASIC', 'PREMIUM', 'ENTERPRISE');
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'PHONE_VERIFIED', 'FULLY_VERIFIED', 'REJECTED', 'SUSPENDED');

-- Step 2: Add User columns (tier/quota system)
ALTER TABLE "users" ADD COLUMN "tier" "DispatcherTier" NOT NULL DEFAULT 'BASIC';
ALTER TABLE "users" ADD COLUMN "tierExpiresAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "dailyOrderCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "dailyCountResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Step 3: Add User columns (verification system)
ALTER TABLE "users" ADD COLUMN "realName" TEXT;
ALTER TABLE "users" ADD COLUMN "nationalIdHash" TEXT;
ALTER TABLE "users" ADD COLUMN "taxId" TEXT;
ALTER TABLE "users" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "lineId" TEXT;
ALTER TABLE "users" ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "users" ADD COLUMN "verifiedAt" TIMESTAMP(3);

-- Step 4: Clean duplicate phone (0932670413, keep latest by createdAt) then add unique constraint
-- Cleanup SQL run externally by owner before this migration applies
-- The unique constraint:
ALTER TABLE "users" ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");

-- Step 5: Add Dispatcher column
ALTER TABLE "dispatchers" ADD COLUMN "duplicateHandling" TEXT NOT NULL DEFAULT 'auto_merge';

-- Step 6: Add Order surge columns
ALTER TABLE "orders" ADD COLUMN "originalPrice" INTEGER;
ALTER TABLE "orders" ADD COLUMN "currentPrice" INTEGER;
ALTER TABLE "orders" ADD COLUMN "isSurge" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "surgeEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "orders" ADD COLUMN "surgeCount" INTEGER NOT NULL DEFAULT 0;

-- Step 7: Create OrderSurgeHistory model
CREATE TABLE "order_surge_history" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "previousPrice" INTEGER NOT NULL,
  "surgeAmount" INTEGER NOT NULL,
  "newPrice" INTEGER NOT NULL,
  "surgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "surgedBy" TEXT NOT NULL
);
CREATE INDEX "order_surge_history_orderId_idx" ON "order_surge_history"("orderId");

-- Step 8: Create RegionPriceStats model
CREATE TABLE "region_price_stats" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "region" TEXT NOT NULL,
  "timeSlot" TEXT NOT NULL,
  "airport" TEXT,
  "vehicleType" TEXT,
  "avgPrice" INTEGER NOT NULL,
  "sampleSize" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "region_price_stats_region_timeSlot_airport_vehicleType_key" ON "region_price_stats"("region", "timeSlot", "airport", "vehicleType");

-- Step 9: Create DispatcherPreference model (separate model, same migration)
CREATE TABLE "dispatcher_preferences" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dispatcherId" TEXT NOT NULL UNIQUE,
  "defaultVehicleType" TEXT,
  "defaultLicenseType" TEXT,
  "defaultPrice" INTEGER,
  "defaultAirport" TEXT,
  "driverRequirements" JSONB,
  "paymentMethod" TEXT,
  "batchPriceMode" TEXT NOT NULL DEFAULT 'off',
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Step 10: Add foreign key for OrderSurgeHistory.orderId
ALTER TABLE "order_surge_history" ADD CONSTRAINT "order_surge_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE;