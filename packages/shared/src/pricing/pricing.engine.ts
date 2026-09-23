import { ChargeableBasis } from '../constants/enums.js';
import {
  PackagePricingInput,
  PricingConfigInput,
  ShipmentPricingResult,
  PackagePricingBreakdown,
  HgReason,
} from './pricing.types.js';
import { roundDiv, calcVolumeMm3, calcEdgeRatio } from './integer-math.js';

export const BASIS_POINTS_SCALE = 10_000n;
export const CBM_TO_MM3_DIVISOR = 1_000_000_000n;
export const KG_TO_GRAMS_DIVISOR = 1_000n;

/**
 * Evaluates the Geometric & Stacking Surcharge Factor (Hg) for an individual package.
 *
 * Precedence:
 * 1. noStack (1.30 / 13000 bps) - Wastes entire vertical container column
 * 2. isFragile OR odd-ratio (> maxEdgeRatioThreshold) (1.15 / 11500 bps)
 * 3. standard (1.00 / 10000 bps) - Rectangular, stackable box
 */
export function determinePackageHg(
  pkg: PackagePricingInput,
  config: PricingConfigInput,
): { factorBps: number; reason: HgReason; edgeRatio: number } {
  const edgeRatio = calcEdgeRatio(pkg.lengthMm, pkg.widthMm, pkg.heightMm);

  if (pkg.noStack) {
    return {
      factorBps: config.noStackSurchargeBps,
      reason: 'NO_STACK',
      edgeRatio,
    };
  }

  if (pkg.isFragile) {
    return {
      factorBps: config.irregularSurchargeBps,
      reason: 'FRAGILE',
      edgeRatio,
    };
  }

  if (edgeRatio > config.maxEdgeRatioThreshold) {
    return {
      factorBps: config.irregularSurchargeBps,
      reason: 'ODD_DIMENSION_RATIO',
      edgeRatio,
    };
  }

  return {
    factorBps: config.standardSurchargeBps,
    reason: 'STANDARD',
    edgeRatio,
  };
}

/**
 * Pure, deterministic pricing calculation engine for LOGIX-3D shipments.
 * 100% Integer arithmetic in VNĐ (No floating point numbers).
 *
 * Formula: P_total = max(V * Pv, W * Pw) * Hg + P_fixed
 */
export function calculateShipmentPricing(
  packages: PackagePricingInput[],
  config: PricingConfigInput,
): ShipmentPricingResult {
  let totalVolumeMm3 = 0n;
  let totalWeightGrams = 0n;

  const packageBreakdowns: PackagePricingBreakdown[] = [];
  let maxHgBps = config.standardSurchargeBps;
  let maxHgReason: HgReason = 'STANDARD';

  for (const pkg of packages) {
    if (pkg.lengthMm <= 0 || pkg.widthMm <= 0 || pkg.heightMm <= 0 || pkg.weightGrams <= 0) {
      throw new Error(`Kiện hàng "${pkg.packageCode || 'Không rõ'}" phải có kích thước và khối lượng lớn hơn 0`);
    }

    const vol =
      pkg.volumeMm3 ??
      calcVolumeMm3(pkg.lengthMm, pkg.widthMm, pkg.heightMm);
    const weightGrams = BigInt(Math.max(0, Math.round(pkg.weightGrams)));

    totalVolumeMm3 += vol;
    totalWeightGrams += weightGrams;

    const { factorBps, reason, edgeRatio } = determinePackageHg(pkg, config);

    packageBreakdowns.push({
      packageCode: pkg.packageCode,
      volumeMm3: vol,
      weightGrams: Number(weightGrams),
      edgeRatio,
      hgFactorBps: factorBps,
      hgReason: reason,
    });

    // Conflict resolution: Take highest Hg across all packages
    if (factorBps > maxHgBps) {
      maxHgBps = factorBps;
      maxHgReason = reason;
    }
  }

  // 1. Calculate Base Volume Amount: roundDiv(totalVolumeMm3 * cbmRate, 10^9)
  const baseVolumeAmount = roundDiv(
    totalVolumeMm3 * config.cbmRate,
    CBM_TO_MM3_DIVISOR,
  );

  // 2. Calculate Base Weight Amount: roundDiv(totalWeightGrams * weightRateKg, 1000)
  const baseWeightAmount = roundDiv(
    totalWeightGrams * config.weightRateKg,
    KG_TO_GRAMS_DIVISOR,
  );

  // 3. Determine Chargeable Basis (Volume vs Weight)
  const isVolumeBasis = baseVolumeAmount >= baseWeightAmount;
  const chargeableBasis = isVolumeBasis
    ? ChargeableBasis.VOLUME
    : ChargeableBasis.WEIGHT;
  const winningBaseAmount = isVolumeBasis ? baseVolumeAmount : baseWeightAmount;

  // 4. Apply Geometric Surcharge Factor (Hg) using Basis Points
  const surchargedAmount = roundDiv(
    winningBaseAmount * BigInt(maxHgBps),
    BASIS_POINTS_SCALE,
  );
  const surchargeFee = surchargedAmount - winningBaseAmount;

  // 5. Add Fixed Fee
  const totalAmount = surchargedAmount + config.fixedFee;

  return {
    totalPackages: packages.length,
    totalVolumeMm3,
    totalWeightGrams,
    baseVolumeAmount,
    baseWeightAmount,
    chargeableBasis,
    winningBaseAmount,
    hgFactorBps: maxHgBps,
    hgReason: maxHgReason,
    surchargedAmount,
    surchargeFee,
    fixedFee: config.fixedFee,
    totalAmount,
    packageBreakdowns,
  };
}
