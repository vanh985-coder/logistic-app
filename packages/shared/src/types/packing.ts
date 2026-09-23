export type PackingStrategy = 'MAX_VOLUME' | 'CONSIGNEE_GROUPED' | 'LIFO_PRIORITY';

export type QualitativeRating =
  | 'VERY_GOOD'
  | 'GOOD'
  | 'FAIR'
  | 'AVERAGE'
  | 'POOR'
  | 'XUAT_SAC'
  | 'RAT_TOT'
  | 'TOT'
  | 'KHA'
  | 'TRUNG_BINH';

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

export interface EvaluationCriteriaMap {
  volumeUtilization: CriterionResult;
  weightUtilization: CriterionResult;
  cogDeviation: CriterionResult;
  stabilityScore: CriterionResult;
  cargoCompatibility: CriterionResult;
  lifoCompliance: CriterionResult;
  consigneeAccessibility: CriterionResult;
  [key: string]: CriterionResult;
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
  criteria: EvaluationCriteriaMap | CriterionResult[];
  overallScore: number;
}

export interface CenterOfGravity {
  xMm: number;
  yMm: number;
  zMm: number;
  xPercentage: number;
  yPercentage: number;
  zPercentage: number;
}

export interface PackedPlacement {
  packageId: string;
  xMm: number;
  yMm: number;
  zMm: number;
  placedLengthMm: number;
  placedWidthMm: number;
  placedHeightMm: number;
  rotation: number;
  layerIndex: number;
}

export interface UnplacedPackage {
  packageId: string;
  reason: string;
}

export interface ContainerDimension {
  innerLengthMm: number;
  innerWidthMm: number;
  innerHeightMm: number;
  maxPayloadGram: number;
}

export interface PackingResult {
  strategy?: PackingStrategy;
  evaluation?: StrategyEvaluation;
  fillRateBps: number;
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
