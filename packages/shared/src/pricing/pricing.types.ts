import { ChargeableBasis } from '../constants/enums.js';

export type HgReason = 'STANDARD' | 'FRAGILE' | 'ODD_DIMENSION_RATIO' | 'NO_STACK';

export interface PackagePricingInput {
  id?: string;
  packageCode?: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightGrams: number;
  isFragile?: boolean;
  noStack?: boolean;
  volumeMm3?: bigint;
}

export interface PricingConfigInput {
  cbmRate: bigint;
  weightRateKg: bigint;
  fixedFee: bigint;
  standardSurchargeBps: number;
  irregularSurchargeBps: number;
  noStackSurchargeBps: number;
  maxEdgeRatioThreshold: number;
}

export interface PackagePricingBreakdown {
  packageCode?: string;
  volumeMm3: bigint;
  weightGrams: number;
  edgeRatio: number;
  hgFactorBps: number;
  hgReason: HgReason;
}

export interface ShipmentPricingResult {
  totalPackages: number;
  totalVolumeMm3: bigint;
  totalWeightGrams: bigint;
  baseVolumeAmount: bigint;
  baseWeightAmount: bigint;
  chargeableBasis: ChargeableBasis;
  winningBaseAmount: bigint;
  hgFactorBps: number;
  hgReason: HgReason;
  surchargedAmount: bigint;
  surchargeFee: bigint;
  fixedFee: bigint;
  totalAmount: bigint;
  packageBreakdowns: PackagePricingBreakdown[];
}
