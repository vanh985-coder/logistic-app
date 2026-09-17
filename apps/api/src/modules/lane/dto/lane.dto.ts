export interface CreateLaneDto {
  code: string;
  name: string;
  origin: string;
  destination: string;
  cbmRate: number | string;
  weightRateKg: number | string;
  fixedFee?: number | string;
  standardSurchargeBps?: number;
  irregularSurchargeBps?: number;
  noStackSurchargeBps?: number;
  maxEdgeRatioThreshold?: number;
}

export interface CreatePricingConfigDto {
  cbmRate: number | string;
  weightRateKg: number | string;
  fixedFee?: number | string;
  standardSurchargeBps?: number;
  irregularSurchargeBps?: number;
  noStackSurchargeBps?: number;
  maxEdgeRatioThreshold?: number;
}
