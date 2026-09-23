export interface QuoteCostBreakdown {
  oceanFreight: bigint;
  handlingFee: bigint;
  documentationFee: bigint;
  surcharges: bigint;
  vatRateBps: number; // e.g. 1000 = 10%
  vatAmount: bigint;
  totalAmount: bigint;
}

export interface QuoteInput {
  oceanFreight: bigint;
  handlingFee: bigint;
  documentationFee: bigint;
  surcharges: bigint;
  vatRateBps?: number; // default 1000 (10%)
}

export interface ShipperShipmentAllocationInput {
  shipmentId: string;
  companyId: string;
  companyName?: string;
  trackingCode: string;
  volumeMm3: bigint;
  weightGrams: bigint;
  baseFreightCost: bigint; // Phase 2 benchmark cost C_i
}

export interface AllocatedShipperQuote {
  shipmentId: string;
  companyId: string;
  companyName?: string;
  trackingCode: string;
  volumeMm3: bigint;
  weightGrams: bigint;
  baseFreightCost: bigint;
  costShareBps: number; // e.g. 2500 = 25.00%
  allocatedAmount: bigint;
  breakdown: {
    oceanFreight: bigint;
    handlingFee: bigint;
    documentationFee: bigint;
    surcharges: bigint;
    vatAmount: bigint;
    totalAmount: bigint;
  };
}

export interface AllocatedQuoteResult {
  totalAmount: bigint;
  oceanFreight: bigint;
  handlingFee: bigint;
  documentationFee: bigint;
  surcharges: bigint;
  vatAmount: bigint;
  allocations: AllocatedShipperQuote[];
}
