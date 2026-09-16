import { describe, it, expect } from 'vitest';
import { packContainers, ContainerDimension, PackageItem } from '../src/index';

describe('packContainers (Phase 0 Skeleton)', () => {
  it('should return initial skeleton packing result with center of gravity', () => {
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
    expect(result.centerOfGravity.xPercentage).toBe(50.0);
    expect(result.centerOfGravity.yPercentage).toBe(50.0);
    expect(result.algorithmVersion).toBe('1.0.0-skeleton');
    expect(result.unplacedPackages).toHaveLength(1);
    expect(result.unplacedPackages[0].packageId).toBe('pkg-1');
  });
});
