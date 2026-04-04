-- Migration: add_order_timestamps
-- Add startedAt, arrivedAt, pickedUpAt to orders table

ALTER TABLE "orders" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "arrivedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "pickedUpAt" TIMESTAMP(3);
