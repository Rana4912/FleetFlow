/*
  Warnings:

  - A unique constraint covering the columns `[locationId]` on the table `Warehouse` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "GeocodingStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "DeliveryOrder" ADD COLUMN     "deliveryLocationId" UUID,
ADD COLUMN     "pickupLocationId" UUID;

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN     "locationId" UUID;

-- CreateTable
CREATE TABLE "Location" (
    "id" UUID NOT NULL,
    "inputAddress" TEXT NOT NULL,
    "formattedAddress" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "geocodingStatus" "GeocodingStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerPlaceId" TEXT,
    "geocodedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_locationId_key" ON "Warehouse"("locationId");

-- Backfill existing warehouses into Location
WITH mapping AS MATERIALIZED (
    SELECT
        "id" AS warehouse_id,
        gen_random_uuid() AS location_id
    FROM "Warehouse"
    WHERE "locationId" IS NULL
),
inserted AS (
    INSERT INTO "Location" (
        "id",
        "inputAddress",
        "latitude",
        "longitude",
        "geocodingStatus",
        "createdAt",
        "updatedAt"
    )
    SELECT
        m.location_id,
        w."address",
        w."latitude",
        w."longitude",
        'PENDING'::"GeocodingStatus",
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM mapping m
    JOIN "Warehouse" w ON w."id" = m.warehouse_id
    RETURNING "id"
)
UPDATE "Warehouse" w
SET "locationId" = m.location_id
FROM mapping m
JOIN inserted i ON i."id" = m.location_id
WHERE w."id" = m.warehouse_id;

WITH mapping AS MATERIALIZED (
    SELECT
        "id" AS order_id,
        gen_random_uuid() AS location_id,
        "pickupAddress" AS address
    FROM "DeliveryOrder"
    WHERE "pickupLocationId" IS NULL
),
inserted AS (
    INSERT INTO "Location" (
        "id",
        "inputAddress",
        "geocodingStatus",
        "createdAt",
        "updatedAt"
    )
    SELECT
        location_id,
        address,
        'PENDING'::"GeocodingStatus",
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM mapping
    RETURNING "id"
)
UPDATE "DeliveryOrder" o
SET "pickupLocationId" = m.location_id
FROM mapping m
JOIN inserted i ON i."id" = m.location_id
WHERE o."id" = m.order_id;

WITH mapping AS MATERIALIZED (
    SELECT
        "id" AS order_id,
        gen_random_uuid() AS location_id,
        "deliveryAddress" AS address
    FROM "DeliveryOrder"
    WHERE "deliveryLocationId" IS NULL
),
inserted AS (
    INSERT INTO "Location" (
        "id",
        "inputAddress",
        "geocodingStatus",
        "createdAt",
        "updatedAt"
    )
    SELECT
        location_id,
        address,
        'PENDING'::"GeocodingStatus",
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM mapping
    RETURNING "id"
)
UPDATE "DeliveryOrder" o
SET "deliveryLocationId" = m.location_id
FROM mapping m
JOIN inserted i ON i."id" = m.location_id
WHERE o."id" = m.order_id;

-- Index location references for efficient lookups
CREATE INDEX "DeliveryOrder_pickupLocationId_idx"
ON "DeliveryOrder"("pickupLocationId");

CREATE INDEX "DeliveryOrder_deliveryLocationId_idx"
ON "DeliveryOrder"("deliveryLocationId");

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_deliveryLocationId_fkey" FOREIGN KEY ("deliveryLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
