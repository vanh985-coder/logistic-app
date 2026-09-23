-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'RECEIVED_CFS', 'SEALED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ShipmentStatus" ADD VALUE 'RECEIVED_CFS';
ALTER TYPE "ShipmentStatus" ADD VALUE 'SEALED';

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "matchGroupId" TEXT NOT NULL,
    "fwdCompanyId" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
    "oceanFreight" BIGINT NOT NULL,
    "handlingFee" BIGINT NOT NULL,
    "documentationFee" BIGINT NOT NULL,
    "surcharges" BIGINT NOT NULL,
    "vatRateBps" INTEGER NOT NULL DEFAULT 1000,
    "vatAmount" BIGINT NOT NULL,
    "totalAmount" BIGINT NOT NULL,
    "transitDays" INTEGER NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "matchGroupId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "fwdCompanyId" TEXT NOT NULL,
    "cfsCompanyId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "totalAmount" BIGINT NOT NULL,
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotes_matchGroupId_status_idx" ON "quotes"("matchGroupId", "status");

-- CreateIndex
CREATE INDEX "quotes_fwdCompanyId_idx" ON "quotes"("fwdCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_bookingNumber_key" ON "bookings"("bookingNumber");

-- CreateIndex
CREATE INDEX "bookings_matchGroupId_idx" ON "bookings"("matchGroupId");

-- CreateIndex
CREATE INDEX "bookings_fwdCompanyId_idx" ON "bookings"("fwdCompanyId");

-- CreateIndex
CREATE INDEX "bookings_cfsCompanyId_idx" ON "bookings"("cfsCompanyId");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_matchGroupId_fkey" FOREIGN KEY ("matchGroupId") REFERENCES "match_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_fwdCompanyId_fkey" FOREIGN KEY ("fwdCompanyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_matchGroupId_fkey" FOREIGN KEY ("matchGroupId") REFERENCES "match_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_fwdCompanyId_fkey" FOREIGN KEY ("fwdCompanyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cfsCompanyId_fkey" FOREIGN KEY ("cfsCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
