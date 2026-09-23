-- AlterTable
ALTER TABLE "match_group_shipments" ADD COLUMN "dropOrder" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "deliveryDestination" TEXT;

-- AlterTable
ALTER TABLE "packages" ADD COLUMN "dropOrder" INTEGER;
