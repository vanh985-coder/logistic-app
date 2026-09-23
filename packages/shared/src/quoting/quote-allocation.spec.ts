import { describe, it, expect } from 'vitest';
import {
  allocateProportionalBigInt,
  calculateAllocatedQuotes,
} from './quote-allocation.js';
import { ShipperShipmentAllocationInput, QuoteInput } from './quote.types.js';

describe('Quote Allocation - Remainder Preserving Integer Math', () => {
  it('allocateProportionalBigInt: divides 1,000,000 VND across 3 equal shippers without losing 1 dong', () => {
    const total = 1_000_000n;
    const weights = [100n, 100n, 100n]; // 1:1:1 ratio
    const shares = allocateProportionalBigInt(total, weights);

    expect(shares).toHaveLength(3);
    // 1_000_000 / 3 = 333,333; last shipper gets 333,334
    expect(shares[0]).toBe(333_333n);
    expect(shares[1]).toBe(333_333n);
    expect(shares[2]).toBe(333_334n);

    const sum = shares.reduce((acc, s) => acc + s, 0n);
    expect(sum).toBe(1_000_000n);
  });

  it('allocateProportionalBigInt: divides 1,000,000 VND across 3 shippers with arbitrary proportions', () => {
    const total = 1_000_000n;
    // Arbitrary weights: 17, 31, 52 (sum = 100)
    const weights = [17n, 31n, 52n];
    const shares = allocateProportionalBigInt(total, weights);

    expect(shares).toHaveLength(3);
    expect(shares[0]).toBe(170_000n);
    expect(shares[1]).toBe(310_000n);
    expect(shares[2]).toBe(520_000n);

    const sum = shares.reduce((acc, s) => acc + s, 0n);
    expect(sum).toBe(1_000_000n);
  });

  it('allocateProportionalBigInt: divides 1,000,000 VND across 3 shippers with awkward prime weights', () => {
    const total = 1_000_000n;
    // Prime weights: 13, 17, 29 (sum = 59)
    const weights = [13n, 17n, 29n];
    const shares = allocateProportionalBigInt(total, weights);

    expect(shares).toHaveLength(3);
    const sum = shares.reduce((acc, s) => acc + s, 0n);
    expect(sum).toBe(1_000_000n);
  });

  it('calculateAllocatedQuotes: full container quote allocation across 4 shippers', () => {
    const quote: QuoteInput = {
      oceanFreight: 25_000_000n,
      handlingFee: 2_500_000n,
      documentationFee: 800_000n,
      surcharges: 1_200_000n,
      vatRateBps: 1000, // 10%
    };

    // Subtotal = 29,500,000; VAT = 2,950,000; Total = 32,450,000 VND
    const shipments: ShipperShipmentAllocationInput[] = [
      {
        shipmentId: 's1',
        companyId: 'c1',
        companyName: 'Công ty Cổ phần May Sài Gòn',
        trackingCode: 'TRK-S1',
        volumeMm3: 15_000_000_000n, // 15 CBM
        weightGrams: 3_000_000n,
        baseFreightCost: 30_000_000n,
      },
      {
        shipmentId: 's2',
        companyId: 'c2',
        companyName: 'Công ty Cơ khí Tân Bình',
        trackingCode: 'TRK-S2',
        volumeMm3: 20_000_000_000n, // 20 CBM
        weightGrams: 5_000_000n,
        baseFreightCost: 40_000_000n,
      },
      {
        shipmentId: 's3',
        companyId: 'c3',
        companyName: 'Công ty Đồ gỗ Phú Tài',
        trackingCode: 'TRK-S3',
        volumeMm3: 10_000_000_000n, // 10 CBM
        weightGrams: 2_000_000n,
        baseFreightCost: 20_000_000n,
      },
      {
        shipmentId: 's4',
        companyId: 'c4',
        companyName: 'Công ty Điện tử VinaTech',
        trackingCode: 'TRK-S4',
        volumeMm3: 5_000_000_000n, // 5 CBM
        weightGrams: 1_000_000n,
        baseFreightCost: 10_000_000n,
      },
    ];

    const result = calculateAllocatedQuotes({ quote, shipments });

    expect(result.totalAmount).toBe(32_450_000n);
    expect(result.oceanFreight).toBe(25_000_000n);
    expect(result.handlingFee).toBe(2_500_000n);
    expect(result.documentationFee).toBe(800_000n);
    expect(result.surcharges).toBe(1_200_000n);
    expect(result.vatAmount).toBe(2_950_000n);

    expect(result.allocations).toHaveLength(4);

    // Verify sum of each component matches total
    const sumOcean = result.allocations.reduce((acc, a) => acc + a.breakdown.oceanFreight, 0n);
    const sumHandling = result.allocations.reduce((acc, a) => acc + a.breakdown.handlingFee, 0n);
    const sumDoc = result.allocations.reduce((acc, a) => acc + a.breakdown.documentationFee, 0n);
    const sumSurcharges = result.allocations.reduce((acc, a) => acc + a.breakdown.surcharges, 0n);
    const sumVat = result.allocations.reduce((acc, a) => acc + a.breakdown.vatAmount, 0n);
    const sumTotal = result.allocations.reduce((acc, a) => acc + a.allocatedAmount, 0n);

    expect(sumOcean).toBe(quote.oceanFreight);
    expect(sumHandling).toBe(quote.handlingFee);
    expect(sumDoc).toBe(quote.documentationFee);
    expect(sumSurcharges).toBe(quote.surcharges);
    expect(sumVat).toBe(result.vatAmount);
    expect(sumTotal).toBe(result.totalAmount);

    // Verify each shipper's breakdown equals their allocatedAmount
    for (const alloc of result.allocations) {
      const b = alloc.breakdown;
      const expectedTotal = b.oceanFreight + b.handlingFee + b.documentationFee + b.surcharges + b.vatAmount;
      expect(alloc.allocatedAmount).toBe(expectedTotal);
      expect(b.totalAmount).toBe(expectedTotal);
    }
  });

  it('calculateAllocatedQuotes: handles single shipper taking 100% of container', () => {
    const quote: QuoteInput = {
      oceanFreight: 20_000_000n,
      handlingFee: 2_000_000n,
      documentationFee: 500_000n,
      surcharges: 500_000n,
      vatRateBps: 1000,
    };

    const shipments: ShipperShipmentAllocationInput[] = [
      {
        shipmentId: 'single-1',
        companyId: 'c1',
        trackingCode: 'TRK-SINGLE',
        volumeMm3: 65_000_000_000n,
        weightGrams: 15_000_000n,
        baseFreightCost: 80_000_000n,
      },
    ];

    const result = calculateAllocatedQuotes({ quote, shipments });
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].allocatedAmount).toBe(result.totalAmount);
    expect(result.allocations[0].costShareBps).toBe(10000);
  });

  it('calculateAllocatedQuotes: handles empty shipments list gracefully', () => {
    const quote: QuoteInput = {
      oceanFreight: 10_000_000n,
      handlingFee: 1_000_000n,
      documentationFee: 500_000n,
      surcharges: 0n,
    };

    const result = calculateAllocatedQuotes({ quote, shipments: [] });
    expect(result.allocations).toHaveLength(0);
    expect(result.totalAmount).toBe(12_650_000n); // 11.5M + 1.15M VAT
  });
});
