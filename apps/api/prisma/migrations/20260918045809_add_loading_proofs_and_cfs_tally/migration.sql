-- CreateEnum
CREATE TYPE "LoadingProofType" AS ENUM ('INBOUND_INSPECTION', 'LAYER_PACKED', 'SEAL_CLOSED');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "containerNo" TEXT,
ADD COLUMN     "sealNo" TEXT,
ADD COLUMN     "sealedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "match_group_shipments" ADD COLUMN     "actualPackageCount" INTEGER,
ADD COLUMN     "discrepancyReason" TEXT,
ADD COLUMN     "isDiscrepant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tallyAt" TIMESTAMP(3),
ADD COLUMN     "tallyStatus" TEXT NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "loading_proofs" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "matchGroupId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "companyId" TEXT NOT NULL,
    "proofType" "LoadingProofType" NOT NULL,
    "layerIndex" INTEGER,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loading_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loading_proofs_bookingId_proofType_idx" ON "loading_proofs"("bookingId", "proofType");

-- CreateIndex
CREATE INDEX "loading_proofs_matchGroupId_idx" ON "loading_proofs"("matchGroupId");

-- CreateIndex
CREATE INDEX "loading_proofs_shipmentId_idx" ON "loading_proofs"("shipmentId");

-- CreateIndex
CREATE INDEX "loading_proofs_companyId_idx" ON "loading_proofs"("companyId");

-- AddForeignKey
ALTER TABLE "loading_proofs" ADD CONSTRAINT "loading_proofs_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loading_proofs" ADD CONSTRAINT "loading_proofs_matchGroupId_fkey" FOREIGN KEY ("matchGroupId") REFERENCES "match_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loading_proofs" ADD CONSTRAINT "loading_proofs_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loading_proofs" ADD CONSTRAINT "loading_proofs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
