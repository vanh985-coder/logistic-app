import { describe, it, expect } from 'vitest';
import { packContainers, ContainerDimension, PackageItem } from '../src/index';

describe('packContainers (Phase 4 Extreme Point Engine)', () => {
  it('should successfully place a valid package and return complete result', () => {
    const container: ContainerDimension = {
      innerLengthMm: 5898,
      innerWidthMm: 2352,
      innerHeightMm: 2393,
      maxPayloadGram: 28000000,
    };

    const packages: PackageItem[] = [
      {
        id: 'pkg-1',
        lengthMm: 1200,
        widthMm: 800,
        heightMm: 1000,
        weightGram: 500000,
        fragile: false,
        noStack: false,
        rotatable: true,
      },
    ];

    const result = packContainers(container, packages);

    expect(result).toBeDefined();
    expect(result.algorithmVersion).toBe('4.0.0-ep-engine');
    expect(result.placedPackages).toHaveLength(1);
    expect(result.placedPackages[0].xMm).toBeGreaterThanOrEqual(0);
    expect(result.placedPackages[0].yMm).toBe(0);
    expect(result.placedPackages[0].zMm).toBe(0);
    expect(result.centerOfGravity.xPercentage).toBeGreaterThanOrEqual(45.0);
    expect(result.centerOfGravity.xPercentage).toBeLessThanOrEqual(55.0);
    expect(result.unplacedPackages).toHaveLength(0);
    expect(result.fillRateBps).toBeGreaterThan(0);
  });
});
