import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { packContainers } from '../src/engine/packer';
import { ContainerDimension, PackageItem } from '../src/geometry/types';
import { intersectsAABB, Box3D } from '../src/geometry/aabb';

describe('Property-Based Testing (fast-check, 1000 runs)', () => {
  const container20DC: ContainerDimension = {
    innerLengthMm: 5898,
    innerWidthMm: 2352,
    innerHeightMm: 2393,
    maxPayloadGram: 28200000,
  };

  const packageArbitrary = fc.record({
    id: fc.uuid(),
    lengthMm: fc.integer({ min: 200, max: 2000 }),
    widthMm: fc.integer({ min: 200, max: 1500 }),
    heightMm: fc.integer({ min: 200, max: 1500 }),
    weightGram: fc.integer({ min: 10000, max: 500000 }), // 10kg to 500kg
    fragile: fc.boolean(),
    noStack: fc.boolean(),
    rotatable: fc.boolean(),
    dropOrder: fc.integer({ min: 1, max: 3 }),
  });

  const packagesListArbitrary = fc.array(packageArbitrary, { minLength: 1, maxLength: 15 });

  it('should satisfy Invariants 1 (No Overflow) and 2 (No Collision) over 1000 random test cases', () => {
    fc.assert(
      fc.property(packagesListArbitrary, (packages: PackageItem[]) => {
        const result = packContainers(container20DC, packages, {
          maxEvaluations: 10, // Keep per-run budget small so 1000 property runs execute in < 15s
        });

        const placed = result.placedPackages;

        // Invariant 1: Tất cả kiện đã xếp phải nằm hoàn toàn trong lòng container (No boundary breach)
        for (const p of placed) {
          expect(p.xMm).toBeGreaterThanOrEqual(0);
          expect(p.yMm).toBeGreaterThanOrEqual(0);
          expect(p.zMm).toBeGreaterThanOrEqual(0);

          expect(p.xMm + p.placedLengthMm).toBeLessThanOrEqual(container20DC.innerLengthMm);
          expect(p.yMm + p.placedWidthMm).toBeLessThanOrEqual(container20DC.innerWidthMm);
          expect(p.zMm + p.placedHeightMm).toBeLessThanOrEqual(container20DC.innerHeightMm);
        }

        // Invariant 2: Không có bất kỳ 2 kiện nào bị chồng lấn thể tích AABB (No physical collision)
        for (let i = 0; i < placed.length; i++) {
          const b1: Box3D = {
            x: placed[i].xMm,
            y: placed[i].yMm,
            z: placed[i].zMm,
            w: placed[i].placedLengthMm,
            l: placed[i].placedWidthMm,
            h: placed[i].placedHeightMm,
          };

          for (let j = i + 1; j < placed.length; j++) {
            const b2: Box3D = {
              x: placed[j].xMm,
              y: placed[j].yMm,
              z: placed[j].zMm,
              w: placed[j].placedLengthMm,
              l: placed[j].placedWidthMm,
              h: placed[j].placedHeightMm,
            };

            const overlaps = intersectsAABB(b1, b2);
            expect(overlaps).toBe(false);
          }
        }
      }),
      { numRuns: 1000 },
    );
  }, 60000); // 60s timeout for 1000 runs
});
