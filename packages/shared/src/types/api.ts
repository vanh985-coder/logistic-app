export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    cursor?: {
      next?: string | null;
      prev?: string | null;
    };
  };
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  services: {
    database: {
      status: 'up' | 'down';
      latencyMs?: number;
    };
    redis: {
      status: 'up' | 'down';
      latencyMs?: number;
    };
  };
}

export interface ContainerTypeDto {
  id: string;
  code: string;
  name: string;
  innerLengthMm: number;
  innerWidthMm: number;
  innerHeightMm: number;
  volumeMm3: string;
  volumeCbm: number;
  maxPayloadGram: string;
  maxPayloadKg: number;
  tareWeightGram: string;
  tareWeightKg: number;
  isActive: boolean;
}

export interface MatchGroupDto {
  id: string;
  code: string;
  laneId: string;
  lane?: {
    id: string;
    code: string;
    name: string;
    origin: string;
    destination: string;
  };
  targetContainerTypeId: string;
  targetContainerType?: ContainerTypeDto;
  status: string;
  cutoffTime?: string | null;
  totalCbmMm3: string;
  totalCbm: number;
  totalWeightGrams: string;
  totalWeightKg: number;
  volumeFillBps: number;
  volumeFillRate: number;
  weightFillBps: number;
  weightFillRate: number;
  shipmentCount: number;
  shipments?: Array<{
    id: string;
    shipmentId: string;
    joinedAt: string;
    shipment: {
      id: string;
      trackingCode: string;
      companyId: string;
      company?: {
        id: string;
        name: string;
        taxCode: string;
      };
      status: string;
      totalPackages: number;
      volumeMm3: string;
      volumeCbm: number;
      weightGrams: string;
      weightKg: number;
      totalAmount: string;
      chargeableBasis: string;
    };
  }>;
  createdAt: string;
  updatedAt: string;
}
