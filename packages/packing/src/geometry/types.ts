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
  reason:
    | 'EXCEED_DIMENSIONS'
    | 'EXCEED_PAYLOAD'
    | 'NO_SUPPORT'
    | 'MAX_STACK_WEIGHT_EXCEEDED'
    | 'NO_VALID_PLACEMENT'
    | 'TIME_BUDGET_EXCEEDED';
}

export interface CenterOfGravity {
  xMm: number;
  yMm: number;
  zMm: number;
  xPercentage: number;
  yPercentage: number;
  zPercentage: number;
}

export interface PackingOptions {
  timeBudgetMs?: number; // Watchdog timeout in ms (default 8000)
  seed?: number; // Deterministic seed (if not provided, computed from input fingerprint)
  maxEvaluations?: number; // Fixed iteration budget (default 8)
  contactToleranceMm?: number; // Contact tolerance for bottom support (default 5 mm)
  minSupportRatioBps?: number; // Minimum bottom support in bps (default 8000 = 80.00%)
}

export interface PackingResult {
  fillRateBps: number; // e.g. 9250 = 92.50%
  centerOfGravity: CenterOfGravity;
  placedPackages: PackedPlacement[];
  unplacedPackages: UnplacedPackage[];
  executionTimeMs: number;
  algorithmVersion: string;
  cogViolation: boolean;
  cogWarning?: string;
  totalWeightGrams: number;
  totalVolumeMm3: string;
  iterationsExecuted: number;
  watchdogTriggered: boolean;
  repairStats?: {
    attempted: number;
    applied: boolean;
    type?: string;
  };
  rejectionStats?: {
    boundaryExceeded: number;
    collision: number;
    insufficientSupport: number;
    maxStackWeight: number;
    payloadExceeded: number;
    dimensionsExceeded: number;
  };
}

