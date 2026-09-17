-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('DRAFT', 'PRICED', 'SUBMITTED', 'CONFIRMED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PackageType" AS ENUM ('BOX', 'PALLET', 'CRATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ChargeableBasis" AS ENUM ('VOLUME', 'WEIGHT');

-- CreateTable
CREATE TABLE "lanes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lanes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_configs" (
    "id" TEXT NOT NULL,
    "laneId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "cbmRate" BIGINT NOT NULL,
    "weightRateKg" BIGINT NOT NULL,
    "fixedFee" BIGINT NOT NULL DEFAULT 0,
    "standardSurchargeBps" INTEGER NOT NULL DEFAULT 10000,
    "irregularSurchargeBps" INTEGER NOT NULL DEFAULT 11500,
    "noStackSurchargeBps" INTEGER NOT NULL DEFAULT 13000,
    "maxEdgeRatioThreshold" INTEGER NOT NULL DEFAULT 5,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "laneId" TEXT NOT NULL,
    "pricingConfigId" TEXT NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'DRAFT',
    "totalPackages" INTEGER NOT NULL DEFAULT 0,
    "volumeMm3" BIGINT NOT NULL DEFAULT 0,
    "weightGrams" BIGINT NOT NULL DEFAULT 0,
    "chargeableBasis" "ChargeableBasis" NOT NULL DEFAULT 'VOLUME',
    "baseAmount" BIGINT NOT NULL DEFAULT 0,
    "surchargedAmount" BIGINT NOT NULL DEFAULT 0,
    "totalAmount" BIGINT NOT NULL DEFAULT 0,
    "pricingSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "packageCode" TEXT NOT NULL,
    "lengthMm" INTEGER NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "volumeMm3" BIGINT NOT NULL,
    "weightGrams" INTEGER NOT NULL,
    "isFragile" BOOLEAN NOT NULL DEFAULT false,
    "noStack" BOOLEAN NOT NULL DEFAULT false,
    "packageType" "PackageType" NOT NULL DEFAULT 'BOX',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lanes_code_key" ON "lanes"("code");

-- CreateIndex
CREATE INDEX "pricing_configs_laneId_idx" ON "pricing_configs"("laneId");

-- CreateIndex
CREATE INDEX "pricing_configs_laneId_effectiveTo_idx" ON "pricing_configs"("laneId", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_trackingCode_key" ON "shipments"("trackingCode");

-- CreateIndex
CREATE INDEX "shipments_companyId_status_createdAt_idx" ON "shipments"("companyId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "shipments_laneId_idx" ON "shipments"("laneId");

-- CreateIndex
CREATE INDEX "packages_companyId_shipmentId_idx" ON "packages"("companyId", "shipmentId");

-- CreateIndex
CREATE INDEX "packages_shipmentId_idx" ON "packages"("shipmentId");

-- AddForeignKey
ALTER TABLE "pricing_configs" ADD CONSTRAINT "pricing_configs_laneId_fkey" FOREIGN KEY ("laneId") REFERENCES "lanes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_laneId_fkey" FOREIGN KEY ("laneId") REFERENCES "lanes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_pricingConfigId_fkey" FOREIGN KEY ("pricingConfigId") REFERENCES "pricing_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique index ensuring strictly one active pricing config per lane
CREATE UNIQUE INDEX "pricing_configs_lane_id_current_idx" ON "pricing_configs" ("laneId") WHERE "effectiveTo" IS NULL;

