import {
  MatchingEngine,
  CandidateShipment,
  ContainerSpec,
  MAX_PRELIMINARY_FILL_BPS,
} from './matching-engine';

describe('MatchingEngine', () => {
  const container20DC: ContainerSpec = {
    id: 'cont-20dc',
    code: '20DC',
    name: '20ft Standard',
    innerLengthMm: 5898,
    innerWidthMm: 2352,
    innerHeightMm: 2393,
    volumeMm3: 33200854752n, // ~33.2 CBM
    maxPayloadGram: 28200000n, // 28.2 tons
    tareWeightGram: 2280000n,
  };

  const container40DC: ContainerSpec = {
    id: 'cont-40dc',
    code: '40DC',
    name: '40ft Standard',
    innerLengthMm: 12032,
    innerWidthMm: 2352,
    innerHeightMm: 2393,
    volumeMm3: 67722866688n, // ~67.7 CBM
    maxPayloadGram: 26700000n, // 26.7 tons
    tareWeightGram: 3780000n,
  };

  const container40HC: ContainerSpec = {
    id: 'cont-40hc',
    code: '40HC',
    name: '40ft High Cube',
    innerLengthMm: 12032,
    innerWidthMm: 2352,
    innerHeightMm: 2698,
    volumeMm3: 76351699968n, // ~76.3 CBM
    maxPayloadGram: 26500000n, // 26.5 tons
    tareWeightGram: 3980000n,
  };

  const containers = [container20DC, container40DC, container40HC];

  it('should correctly evaluate package dimensional fit', () => {
    // Fits inside 20DC
    const pkg1 = {
      id: 'p1',
      lengthMm: 1200,
      widthMm: 800,
      heightMm: 1000,
      weightGrams: 50000,
    };
    expect(MatchingEngine.canPackageFitContainer(pkg1, container20DC)).toBe(true);

    // Exceeds container length
    const pkgTooLong = {
      id: 'p2',
      lengthMm: 6000,
      widthMm: 1000,
      heightMm: 1000,
      weightGrams: 50000,
    };
    expect(MatchingEngine.canPackageFitContainer(pkgTooLong, container20DC)).toBe(false);

    // Rotated package that fits (height is 2400 mm but length is 1000 mm and width 800 mm)
    // 2400 <= 5898 (length), 1000 <= 2352 (width), 800 <= 2393 (height)
    const pkgRotated = {
      id: 'p3',
      lengthMm: 800,
      widthMm: 1000,
      heightMm: 2400,
      weightGrams: 50000,
    };
    expect(MatchingEngine.canPackageFitContainer(pkgRotated, container20DC)).toBe(true);
  });

  it('should select 20DC when candidate shipments total <= 30 CBM', () => {
    const shipmentA: CandidateShipment = {
      id: 's1',
      trackingCode: 'SHP-001',
      laneId: 'lane-1',
      volumeMm3: 10_000_000_000n, // 10 CBM
      weightGrams: 5_000_000n, // 5 tons
      totalPackages: 10,
      packages: [{ id: 'p1', lengthMm: 1000, widthMm: 1000, heightMm: 1000, weightGrams: 500000 }],
      companyId: 'comp-1',
    };

    const shipmentB: CandidateShipment = {
      id: 's2',
      trackingCode: 'SHP-002',
      laneId: 'lane-1',
      volumeMm3: 12_000_000_000n, // 12 CBM
      weightGrams: 6_000_000n, // 6 tons
      totalPackages: 12,
      packages: [{ id: 'p2', lengthMm: 1000, widthMm: 1000, heightMm: 1000, weightGrams: 500000 }],
      companyId: 'comp-2',
    };

    const best = MatchingEngine.selectBestContainer([shipmentA, shipmentB], containers);
    expect(best?.code).toBe('20DC');
  });

  it('should select 40DC when candidate shipments exceed 20DC capacity', () => {
    const shipmentLarge: CandidateShipment = {
      id: 's3',
      trackingCode: 'SHP-003',
      laneId: 'lane-1',
      volumeMm3: 45_000_000_000n, // 45 CBM (exceeds 20DC ~33.2 CBM)
      weightGrams: 15_000_000n,
      totalPackages: 40,
      packages: [{ id: 'p3', lengthMm: 1200, widthMm: 800, heightMm: 1000, weightGrams: 300000 }],
      companyId: 'comp-1',
    };

    const best = MatchingEngine.selectBestContainer([shipmentLarge], containers);
    expect(best?.code).toBe('40DC');
  });

  it('should build a consolidation plan respecting payload and volume boundaries', () => {
    const s1: CandidateShipment = {
      id: 's1',
      trackingCode: 'SHP-001',
      laneId: 'lane-1',
      volumeMm3: 15_000_000_000n, // 15 CBM
      weightGrams: 10_000_000n, // 10 tons
      totalPackages: 15,
      packages: [{ id: 'p1', lengthMm: 1000, widthMm: 1000, heightMm: 1000, weightGrams: 600000 }],
      companyId: 'comp-1',
    };

    const s2: CandidateShipment = {
      id: 's2',
      trackingCode: 'SHP-002',
      laneId: 'lane-1',
      volumeMm3: 12_000_000_000n, // 12 CBM
      weightGrams: 8_000_000n, // 8 tons
      totalPackages: 12,
      packages: [{ id: 'p2', lengthMm: 1000, widthMm: 1000, heightMm: 1000, weightGrams: 600000 }],
      companyId: 'comp-2',
    };

    const sExceed: CandidateShipment = {
      id: 's3',
      trackingCode: 'SHP-003',
      laneId: 'lane-1',
      volumeMm3: 20_000_000_000n, // 20 CBM - adding this would exceed 20DC max usable volume!
      weightGrams: 15_000_000n,
      totalPackages: 20,
      packages: [{ id: 'p3', lengthMm: 1000, widthMm: 1000, heightMm: 1000, weightGrams: 600000 }],
      companyId: 'comp-3',
    };

    const plan = MatchingEngine.buildConsolidationPlan([s1, s2, sExceed], container20DC);
    expect(plan).not.toBeNull();
    // Should contain sExceed (20 CBM) + s2 (12 CBM is 32 CBM which exceeds 92% of 33.2 => 30.5 CBM)
    // Or sExceed + s1 (35 CBM > 33.2)
    // So plan selects sExceed (20 CBM) alone or s1 (15 CBM) + s2 (12 CBM) = 27 CBM <= 30.5 CBM
    expect(plan!.totalVolumeMm3).toBeLessThanOrEqual(
      (container20DC.volumeMm3 * BigInt(MAX_PRELIMINARY_FILL_BPS)) / 10000n,
    );
    expect(plan!.totalWeightGrams).toBeLessThanOrEqual(container20DC.maxPayloadGram);
    expect(plan!.volumeFillBps).toBeGreaterThan(0);
    expect(plan!.weightFillBps).toBeGreaterThan(0);
  });
});
