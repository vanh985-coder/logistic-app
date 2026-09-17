import { describe, it, expect } from 'vitest';
import { ChargeableBasis } from '../constants/enums.js';
import { roundDiv, calcVolumeMm3, calcEdgeRatio } from './integer-math.js';
import {
  calculateShipmentPricing,
  determinePackageHg,
} from './pricing.engine.js';
import { PricingConfigInput, PackagePricingInput } from './pricing.types.js';

const defaultConfig: PricingConfigInput = {
  cbmRate: 2_000_000n, // 2,000,000 VND / m3
  weightRateKg: 5_000n, // 5,000 VND / kg
  fixedFee: 50_000n, // 50,000 VND handling fee
  standardSurchargeBps: 10_000, // 1.00
  irregularSurchargeBps: 11_500, // 1.15
  noStackSurchargeBps: 13_000, // 1.30
  maxEdgeRatioThreshold: 5, // ratio > 5 is odd-shaped
};

describe('Integer Math & Round-Half-Up', () => {
  it('should round half up correctly', () => {
    // 5 / 2 = 2.5 -> 3
    expect(roundDiv(5n, 2n)).toBe(3n);
    // 4 / 2 = 2.0 -> 2
    expect(roundDiv(4n, 2n)).toBe(2n);
    // 3 / 2 = 1.5 -> 2
    expect(roundDiv(3n, 2n)).toBe(2n);
    // 1 / 2 = 0.5 -> 1
    expect(roundDiv(1n, 2n)).toBe(1n);
    // 0 / 2 = 0.0 -> 0
    expect(roundDiv(0n, 2n)).toBe(0n);
  });

  it('should compute volume in mm3 as BigInt without overflow', () => {
    // 1000mm x 1000mm x 1000mm = 1,000,000,000 mm3 (1 CBM)
    expect(calcVolumeMm3(1000, 1000, 1000)).toBe(1_000_000_000n);
    // Large package: 12000mm x 2400mm x 2600mm
    const largeVol = calcVolumeMm3(12000, 2400, 2600);
    expect(largeVol).toBe(74_880_000_000n);
  });

  it('should calculate edge ratio correctly', () => {
    // Standard cube
    expect(calcEdgeRatio(500, 500, 500)).toBe(1);
    // 1200 x 200 x 100 -> max 1200, min 100 -> ratio 12
    expect(calcEdgeRatio(1200, 200, 100)).toBe(12);
    // Invalid dimension
    expect(calcEdgeRatio(100, 0, 100)).toBe(0);
  });
});

describe('Hg Geometric Surcharge Factor Evaluation', () => {
  it('Level 1: Standard rectangular box should receive 1.00 (10000 bps)', () => {
    const pkg: PackagePricingInput = {
      lengthMm: 400,
      widthMm: 300,
      heightMm: 200,
      weightGrams: 5000,
      isFragile: false,
      noStack: false,
    };
    const result = determinePackageHg(pkg, defaultConfig);
    expect(result.factorBps).toBe(10_000);
    expect(result.reason).toBe('STANDARD');
    expect(result.edgeRatio).toBe(2); // 400 / 200 = 2 <= 5
  });

  it('Level 2a: Fragile box should receive 1.15 (11500 bps)', () => {
    const pkg: PackagePricingInput = {
      lengthMm: 400,
      widthMm: 300,
      heightMm: 200,
      weightGrams: 5000,
      isFragile: true,
      noStack: false,
    };
    const result = determinePackageHg(pkg, defaultConfig);
    expect(result.factorBps).toBe(11_500);
    expect(result.reason).toBe('FRAGILE');
  });

  it('Level 2b: Odd-dimension ratio box (> threshold 5) should receive 1.15 (11500 bps)', () => {
    const pkg: PackagePricingInput = {
      lengthMm: 1200,
      widthMm: 100,
      heightMm: 100, // 1200 / 100 = 12 > 5
      weightGrams: 3000,
      isFragile: false,
      noStack: false,
    };
    const result = determinePackageHg(pkg, defaultConfig);
    expect(result.factorBps).toBe(11_500);
    expect(result.reason).toBe('ODD_DIMENSION_RATIO');
    expect(result.edgeRatio).toBe(12);
  });

  it('Level 3: noStack package should receive 1.30 (13000 bps)', () => {
    const pkg: PackagePricingInput = {
      lengthMm: 500,
      widthMm: 500,
      heightMm: 500,
      weightGrams: 10000,
      isFragile: false,
      noStack: true,
    };
    const result = determinePackageHg(pkg, defaultConfig);
    expect(result.factorBps).toBe(13_000);
    expect(result.reason).toBe('NO_STACK');
  });

  it('Precedence: noStack (1.30) overrides fragile (1.15) on the same package', () => {
    const pkg: PackagePricingInput = {
      lengthMm: 1200,
      widthMm: 100,
      heightMm: 100,
      weightGrams: 5000,
      isFragile: true,
      noStack: true,
    };
    const result = determinePackageHg(pkg, defaultConfig);
    expect(result.factorBps).toBe(13_000);
    expect(result.reason).toBe('NO_STACK');
  });
});

describe('Shipment Pricing Engine Calculation', () => {
  it('should charge by Volume when Volume amount > Weight amount', () => {
    // 1 CBM (1,000,000,000 mm3), 100 kg (100,000 g)
    // Volume amount: 1 * 2,000,000 = 2,000,000 VND
    // Weight amount: 100 * 5,000 = 500,000 VND
    // Winning: VOLUME (2,000,000)
    // Hg: 1.00 (Standard) -> Surcharged: 2,000,000
    // Fixed fee: 50,000 -> Total: 2,050,000 VND
    const packages: PackagePricingInput[] = [
      {
        packageCode: 'PKG-01',
        lengthMm: 1000,
        widthMm: 1000,
        heightMm: 1000,
        weightGrams: 100_000,
        isFragile: false,
        noStack: false,
      },
    ];

    const result = calculateShipmentPricing(packages, defaultConfig);
    expect(result.chargeableBasis).toBe(ChargeableBasis.VOLUME);
    expect(result.baseVolumeAmount).toBe(2_000_000n);
    expect(result.baseWeightAmount).toBe(500_000n);
    expect(result.winningBaseAmount).toBe(2_000_000n);
    expect(result.hgFactorBps).toBe(10_000);
    expect(result.surchargedAmount).toBe(2_000_000n);
    expect(result.surchargeFee).toBe(0n);
    expect(result.fixedFee).toBe(50_000n);
    expect(result.totalAmount).toBe(2_050_000n);
  });

  it('should charge by Weight when Weight amount > Volume amount', () => {
    // 0.1 CBM (100,000,000 mm3), 500 kg (500,000 g)
    // Volume amount: 0.1 * 2,000,000 = 200,000 VND
    // Weight amount: 500 * 5,000 = 2,500,000 VND
    // Winning: WEIGHT (2,500,000)
    // Fragile box -> Hg = 1.15 (11500)
    // Surcharged: roundDiv(2,500,000 * 11500, 10000) = 2,875,000 VND
    // Surcharge fee: 375,000 VND
    // Fixed fee: 50,000 -> Total: 2,925,000 VND
    const packages: PackagePricingInput[] = [
      {
        packageCode: 'PKG-HEAVY',
        lengthMm: 1000,
        widthMm: 500,
        heightMm: 200,
        weightGrams: 500_000,
        isFragile: true,
        noStack: false,
      },
    ];

    const result = calculateShipmentPricing(packages, defaultConfig);
    expect(result.chargeableBasis).toBe(ChargeableBasis.WEIGHT);
    expect(result.winningBaseAmount).toBe(2_500_000n);
    expect(result.hgFactorBps).toBe(11_500);
    expect(result.hgReason).toBe('FRAGILE');
    expect(result.surchargedAmount).toBe(2_875_000n);
    expect(result.surchargeFee).toBe(375_000n);
    expect(result.totalAmount).toBe(2_925_000n);
  });

  it('Conflict Resolution: shipment with mixed packages takes the MAXIMUM Hg', () => {
    // PKG-1: Standard (10000)
    // PKG-2: Fragile (11500)
    // PKG-3: No-stack (13000)
    // Maximum Hg must be 13000 (NO_STACK)
    const packages: PackagePricingInput[] = [
      {
        packageCode: 'PKG-1',
        lengthMm: 400,
        widthMm: 400,
        heightMm: 400,
        weightGrams: 10_000,
        isFragile: false,
        noStack: false,
      },
      {
        packageCode: 'PKG-2',
        lengthMm: 400,
        widthMm: 400,
        heightMm: 400,
        weightGrams: 10_000,
        isFragile: true,
        noStack: false,
      },
      {
        packageCode: 'PKG-3',
        lengthMm: 400,
        widthMm: 400,
        heightMm: 400,
        weightGrams: 10_000,
        isFragile: false,
        noStack: true,
      },
    ];

    const result = calculateShipmentPricing(packages, defaultConfig);
    expect(result.hgFactorBps).toBe(13_000);
    expect(result.hgReason).toBe('NO_STACK');
    expect(result.packageBreakdowns.length).toBe(3);
    expect(result.packageBreakdowns[0].hgReason).toBe('STANDARD');
    expect(result.packageBreakdowns[1].hgReason).toBe('FRAGILE');
    expect(result.packageBreakdowns[2].hgReason).toBe('NO_STACK');
  });

  it('handles empty package list gracefully', () => {
    const result = calculateShipmentPricing([], defaultConfig);
    expect(result.totalPackages).toBe(0);
    expect(result.totalVolumeMm3).toBe(0n);
    expect(result.totalWeightGrams).toBe(0n);
    expect(result.winningBaseAmount).toBe(0n);
    expect(result.hgFactorBps).toBe(10_000);
    expect(result.totalAmount).toBe(defaultConfig.fixedFee);
  });
});
