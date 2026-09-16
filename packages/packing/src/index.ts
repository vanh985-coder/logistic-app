export interface ContainerDimension {
  innerLengthMm: number;
  innerWidthMm: number;
  innerHeightMm: number;
  maxPayloadGram: number;
}

export interface PackageItem {
  id: string;
  sku?: string;
  name?: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightGram: number;
  fragile: boolean;
  noStack: boolean;
  maxStackWeightGram?: number;
  rotatable: boolean;
  dropOrder?: number;
}

export interface PackedPlacement {
  packageId: string;
  xMm: number;
  yMm: number;
  zMm: number;
  placedLengthMm: number;
  placedWidthMm: number;
  placedHeightMm: number;
  rotation: number; // 0..5 orientation index
  layerIndex: number;
}

export interface UnplacedPackage {
  packageId: string;
  reason: 'EXCEED_DIMENSIONS' | 'EXCEED_PAYLOAD' | 'NO_SUPPORT' | 'TIME_BUDGET_EXCEEDED';
}

export interface CenterOfGravity {
  xMm: number;
  yMm: number;
  zMm: number;
  xPercentage: number;
  yPercentage: number;
}

export interface PackingResult {
  fillRateBps: number; // 8500 = 85.00%
  centerOfGravity: CenterOfGravity;
  placedPackages: PackedPlacement[];
  unplacedPackages: UnplacedPackage[];
  executionTimeMs: number;
  algorithmVersion: string;
}

/**
 * Placeholder stub for Phase 0 walking skeleton.
 * Full heuristic extreme-point implementation will be implemented in Phase 4.
 */
export function packContainers(
  container: ContainerDimension,
  packages: PackageItem[],
  _options?: { timeBudgetMs?: number; seed?: number },
): PackingResult {
  const startTime = Date.now();
  return {
    fillRateBps: 0,
    centerOfGravity: {
      xMm: Math.round(container.innerLengthMm / 2),
      yMm: Math.round(container.innerWidthMm / 2),
      zMm: 0,
      xPercentage: 50.0,
      yPercentage: 50.0,
    },
    placedPackages: [],
    unplacedPackages: packages.map((p) => ({
      packageId: p.id,
      reason: 'TIME_BUDGET_EXCEEDED',
    })),
    executionTimeMs: Date.now() - startTime,
    algorithmVersion: '1.0.0-skeleton',
  };
}
