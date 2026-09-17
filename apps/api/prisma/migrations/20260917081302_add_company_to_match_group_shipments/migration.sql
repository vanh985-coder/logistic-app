/*
  Warnings:

  - Added the required column `companyId` to the `match_group_shipments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: Add column as nullable first
ALTER TABLE "match_group_shipments" ADD COLUMN "companyId" TEXT;

-- Backfill companyId from shipments table
UPDATE "match_group_shipments" mgs
SET "companyId" = s."companyId"
FROM "shipments" s
WHERE mgs."shipmentId" = s.id;

-- Clean up any test records with missing shipment
DELETE FROM "match_group_shipments" WHERE "companyId" IS NULL;

-- Enforce NOT NULL
ALTER TABLE "match_group_shipments" ALTER COLUMN "companyId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "match_group_shipments_companyId_matchGroupId_idx" ON "match_group_shipments"("companyId", "matchGroupId");

-- AddForeignKey
ALTER TABLE "match_group_shipments" ADD CONSTRAINT "match_group_shipments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

