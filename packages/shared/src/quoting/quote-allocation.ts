import { roundDiv } from '../pricing/integer-math.js';
import {
  QuoteInput,
  ShipperShipmentAllocationInput,
  AllocatedQuoteResult,
  AllocatedShipperQuote,
} from './quote.types.js';

/**
 * Distributes a total BigInt value across an array of weights,
 * guaranteeing that the sum of allocated amounts equals `total` exactly.
 *
 * For index 0 to N-2: share_i = floor(total * weight_i / totalWeight)
 * For index N-1: share_{N-1} = total - sum(share_0 ... share_{N-2})
 */
export function allocateProportionalBigInt(total: bigint, weights: bigint[]): bigint[] {
  const n = weights.length;
  if (n === 0) return [];
  if (n === 1) return [total];

  const totalWeight = weights.reduce((acc, w) => acc + w, 0n);
  const result: bigint[] = new Array(n);
  let runningSum = 0n;

  for (let i = 0; i < n - 1; i++) {
    if (totalWeight === 0n) {
      result[i] = total / BigInt(n);
    } else {
      result[i] = (total * weights[i]) / totalWeight;
    }
    runningSum += result[i];
  }

  // Last participant absorbs remainder to prevent any rounding loss
  result[n - 1] = total - runningSum;
  return result;
}

export interface CalculateAllocatedQuotesOptions {
  quote: QuoteInput & {
    vatAmount?: bigint;
    totalAmount?: bigint;
  };
  shipments: ShipperShipmentAllocationInput[];
}

/**
 * Calculates proportional quotes for each shipper in an LCL Match Group based on Phase 2 benchmark cost ratio.
 * Ensures that:
 * 1. Every cost component (ocean, handling, doc, surcharges, VAT) allocated across shippers sums to exact total.
 * 2. Total allocated cost for each shipper equals sum of their component shares.
 * 3. Total allocated amount across all shippers matches quote.totalAmount with zero VND rounding drift.
 */
export function calculateAllocatedQuotes({
  quote,
  shipments,
}: CalculateAllocatedQuotesOptions): AllocatedQuoteResult {
  const vatRateBps = quote.vatRateBps ?? 1000; // default 10%
  const subtotal =
    quote.oceanFreight +
    quote.handlingFee +
    quote.documentationFee +
    quote.surcharges;

  const vatAmount =
    quote.vatAmount ??
    roundDiv(subtotal * BigInt(vatRateBps), 10000n);

  const totalAmount = quote.totalAmount ?? (subtotal + vatAmount);

  if (shipments.length === 0) {
    return {
      totalAmount,
      oceanFreight: quote.oceanFreight,
      handlingFee: quote.handlingFee,
      documentationFee: quote.documentationFee,
      surcharges: quote.surcharges,
      vatAmount,
      allocations: [],
    };
  }

  const weights = shipments.map((s) => s.baseFreightCost);
  const totalWeight = weights.reduce((acc, w) => acc + w, 0n);

  const oceanAllocations = allocateProportionalBigInt(quote.oceanFreight, weights);
  const handlingAllocations = allocateProportionalBigInt(quote.handlingFee, weights);
  const docAllocations = allocateProportionalBigInt(quote.documentationFee, weights);
  const surchargeAllocations = allocateProportionalBigInt(quote.surcharges, weights);
  const vatAllocations = allocateProportionalBigInt(vatAmount, weights);

  const allocations: AllocatedShipperQuote[] = shipments.map((shipment, index) => {
    const o = oceanAllocations[index];
    const h = handlingAllocations[index];
    const d = docAllocations[index];
    const s = surchargeAllocations[index];
    const v = vatAllocations[index];
    const itemTotal = o + h + d + s + v;

    let costShareBps = 0;
    if (totalWeight > 0n) {
      costShareBps = Number((weights[index] * 10000n) / totalWeight);
    } else {
      costShareBps = Math.floor(10000 / shipments.length);
    }

    return {
      shipmentId: shipment.shipmentId,
      companyId: shipment.companyId,
      companyName: shipment.companyName,
      trackingCode: shipment.trackingCode,
      volumeMm3: shipment.volumeMm3,
      weightGrams: shipment.weightGrams,
      baseFreightCost: shipment.baseFreightCost,
      costShareBps,
      allocatedAmount: itemTotal,
      breakdown: {
        oceanFreight: o,
        handlingFee: h,
        documentationFee: d,
        surcharges: s,
        vatAmount: v,
        totalAmount: itemTotal,
      },
    };
  });

  return {
    totalAmount,
    oceanFreight: quote.oceanFreight,
    handlingFee: quote.handlingFee,
    documentationFee: quote.documentationFee,
    surcharges: quote.surcharges,
    vatAmount,
    allocations,
  };
}
