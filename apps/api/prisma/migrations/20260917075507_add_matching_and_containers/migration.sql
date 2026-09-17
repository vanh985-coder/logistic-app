-- CreateEnum
CREATE TYPE "MatchGroupStatus" AS ENUM ('DRAFT', 'PROPOSED', 'CONFIRMED', 'CLOSED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ShipmentStatus" ADD VALUE 'MATCHING';
ALTER TYPE "ShipmentStatus" ADD VALUE 'GROUPED';

-- CreateTable
CREATE TABLE "container_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "innerLengthMm" INTEGER NOT NULL,
    "innerWidthMm" INTEGER NOT NULL,
    "innerHeightMm" INTEGER NOT NULL,
    "volumeMm3" BIGINT NOT NULL,
    "maxPayloadGram" BIGINT NOT NULL,
    "tareWeightGram" BIGINT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "container_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_groups" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "laneId" TEXT NOT NULL,
    "targetContainerTypeId" TEXT NOT NULL,
    "status" "MatchGroupStatus" NOT NULL DEFAULT 'PROPOSED',
    "cutoffTime" TIMESTAMP(3),
    "totalCbmMm3" BIGINT NOT NULL DEFAULT 0,
    "totalWeightGrams" BIGINT NOT NULL DEFAULT 0,
    "volumeFillBps" INTEGER NOT NULL DEFAULT 0,
    "weightFillBps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_group_shipments" (
    "id" TEXT NOT NULL,
    "matchGroupId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_group_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "container_types_code_key" ON "container_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "match_groups_code_key" ON "match_groups"("code");

-- CreateIndex
CREATE INDEX "match_groups_laneId_status_idx" ON "match_groups"("laneId", "status");

-- CreateIndex
CREATE INDEX "match_group_shipments_matchGroupId_idx" ON "match_group_shipments"("matchGroupId");

-- CreateIndex
CREATE INDEX "match_group_shipments_shipmentId_idx" ON "match_group_shipments"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "match_group_shipments_matchGroupId_shipmentId_key" ON "match_group_shipments"("matchGroupId", "shipmentId");

-- AddForeignKey
ALTER TABLE "match_groups" ADD CONSTRAINT "match_groups_laneId_fkey" FOREIGN KEY ("laneId") REFERENCES "lanes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_groups" ADD CONSTRAINT "match_groups_targetContainerTypeId_fkey" FOREIGN KEY ("targetContainerTypeId") REFERENCES "container_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_group_shipments" ADD CONSTRAINT "match_group_shipments_matchGroupId_fkey" FOREIGN KEY ("matchGroupId") REFERENCES "match_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_group_shipments" ADD CONSTRAINT "match_group_shipments_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
