import { describe, it, expect } from 'vitest';
import { packContainers } from '../src/engine/packer';
import { ContainerDimension, PackageItem } from '../src/geometry/types';

describe('Determinism Check', () => {
  const container20DC: ContainerDimension = {
    innerLengthMm: 5898,
    innerWidthMm: 2352,
    innerHeightMm: 2393,
    maxPayloadGram: 28200000,
  };

  const samplePackages: PackageItem[] = [
    {
      id: 'PKG-001',
      lengthMm: 1200,
      widthMm: 800,
      heightMm: 1000,
      weightGram: 350000,
      fragile: false,
      noStack: false,
      rotatable: true,
      dropOrder: 1,
    },
    {
      id: 'PKG-002',
      lengthMm: 1000,
      widthMm: 1000,
      heightMm: 1000,
      weightGram: 400000,
      fragile: false,
      noStack: false,
      rotatable: true,
      dropOrder: 1,
    },
    {
      id: 'PKG-003',
      lengthMm: 800,
      widthMm: 600,
      heightMm: 700,
      weightGram: 150000,
      fragile: false,
      noStack: false,
      rotatable: true,
      dropOrder: 2,
    },
    {
      id: 'PKG-004',
      lengthMm: 1500,
      widthMm: 800,
      heightMm: 900,
      weightGram: 500000,
      fragile: false,
      noStack: false,
      rotatable: true,
      dropOrder: 2,
    },
    {
      id: 'PKG-005',
      lengthMm: 1100,
      widthMm: 900,
      heightMm: 800,
      weightGram: 250000,
      fragile: true,
      noStack: false,
      rotatable: false,
      dropOrder: 1,
    },
  ];

  it('should return identical packing results across 3 separate runs with identical input', () => {
    const run1 = packContainers(container20DC, samplePackages);
    const run2 = packContainers(container20DC, samplePackages);
    const run3 = packContainers(container20DC, samplePackages);

    // 1. Fill rates identical
    expect(run1.fillRateBps).toBe(run2.fillRateBps);
    expect(run2.fillRateBps).toBe(run3.fillRateBps);

    // 2. CoG identical
    expect(run1.centerOfGravity.xMm).toBe(run2.centerOfGravity.xMm);
    expect(run1.centerOfGravity.yMm).toBe(run2.centerOfGravity.yMm);
    expect(run1.centerOfGravity.zMm).toBe(run2.centerOfGravity.zMm);
    expect(run1.centerOfGravity.xPercentage).toBe(run2.centerOfGravity.xPercentage);
    expect(run2.centerOfGravity.xPercentage).toBe(run3.centerOfGravity.xPercentage);

    // 3. Placed packages counts identical
    expect(run1.placedPackages.length).toBe(run2.placedPackages.length);
    expect(run2.placedPackages.length).toBe(run3.placedPackages.length);

    // 4. Exact coordinates and rotations identical for every placement
    for (let i = 0; i < run1.placedPackages.length; i++) {
      const p1 = run1.placedPackages[i];
      const p2 = run2.placedPackages[i];
      const p3 = run3.placedPackages[i];

      expect(p1.packageId).toBe(p2.packageId);
      expect(p2.packageId).toBe(p3.packageId);

      expect(p1.xMm).toBe(p2.xMm);
      expect(p2.xMm).toBe(p3.xMm);

      expect(p1.yMm).toBe(p2.yMm);
      expect(p2.yMm).toBe(p3.yMm);

      expect(p1.zMm).toBe(p2.zMm);
      expect(p2.zMm).toBe(p3.zMm);

      expect(p1.rotation).toBe(p2.rotation);
      expect(p2.rotation).toBe(p3.rotation);
    }

    // 5. Unplaced packages identical
    expect(run1.unplacedPackages).toEqual(run2.unplacedPackages);
    expect(run2.unplacedPackages).toEqual(run3.unplacedPackages);
  });
});
