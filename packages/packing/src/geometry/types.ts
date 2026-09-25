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
  companyId?: string;
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

export type PackingStrategy = 'MAX_VOLUME' | 'CONSIGNEE_GROUPED' | 'LIFO_PRIORITY';

export type QualitativeRating = 'VERY_GOOD' | 'GOOD' | 'FAIR' | 'AVERAGE' | 'POOR';

export interface CriterionResult {
  id: string;
  name: string;
  rawScore: number;
  unit: string;
  rating: QualitativeRating;
  ratingLabel: string;
  description: string;
  alertLevel?: 'NORMAL' | 'WARNING' | 'CRITICAL';
}

export interface StrategyEvaluation {
  strategy: PackingStrategy;
  strategyName: string;
  strategyDescription: string;
  placedCount: number;
  totalCount: number;
  unplacedCount: number;
  placedPercentage: number;
  unplacedAlert: 'NONE' | 'WARNING' | 'CRITICAL';
  unplacedNote: string;
  criteria: {
    volumeUtilization: CriterionResult;
    weightUtilization: CriterionResult;
    cogDeviation: CriterionResult;
    stabilityScore: CriterionResult;
    cargoCompatibility: CriterionResult;
    lifoCompliance: CriterionResult;
    consigneeAccessibility: CriterionResult;
  };
}

export interface PackingOptions {
  strategy?: PackingStrategy; // Default MAX_VOLUME
  timeBudgetMs?: number; // Watchdog timeout in ms (default 8000)
  seed?: number; // Deterministic seed (if not provided, computed from input fingerprint)
  maxEvaluations?: number; // Fixed iteration budget (default 8)
  contactToleranceMm?: number; // Contact tolerance for bottom support (default 5 mm)
  minSupportRatioBps?: number; // Minimum bottom support in bps (default 8000 = 80.00%)
}

export interface PackingResult {
  strategy?: PackingStrategy;
  evaluation?: StrategyEvaluation;
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

export interface MultiStrategyPackingResult {
  strategies: Record<PackingStrategy, PackingResult>;
  recommendedStrategy: PackingStrategy;
  executionTimeMs: number;
}

