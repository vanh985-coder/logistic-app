import { describe, it } from 'vitest';
import { packContainers } from '../src/engine/packer';
import { ContainerDimension, PackageItem } from '../src/geometry/types';

describe('Benchmark (50, 200, 500 packages)', () => {
  const container40HC: ContainerDimension = {
    innerLengthMm: 12032,
    innerWidthMm: 2352,
    innerHeightMm: 2698,
    maxPayloadGram: 26500000, // 26.5 tons
  };

  function generateBenchmarkPackages(count: number): PackageItem[] {
    const pkgs: PackageItem[] = [];
    const cartonSizes = [
      { l: 600, w: 400, h: 400, weight: 25000 },
      { l: 800, w: 600, h: 500, weight: 45000 },
      { l: 500, w: 500, h: 500, weight: 30000 },
      { l: 1000, w: 800, h: 600, weight: 70000 },
      { l: 400, w: 300, h: 300, weight: 15000 },
      { l: 1200, w: 800, h: 900, weight: 120000 },
    ];

    for (let i = 1; i <= count; i++) {
      const size = cartonSizes[i % cartonSizes.length];
      pkgs.push({
        id: `PKG-${String(i).padStart(4, '0')}`,
        lengthMm: size.l,
        widthMm: size.w,
        heightMm: size.h,
        weightGram: size.weight,
        fragile: i % 15 === 0,
        noStack: i % 20 === 0,
        rotatable: true,
        dropOrder: (i % 3) + 1,
      });
    }

    return pkgs;
  }

  it('Benchmark 50 packages', () => {
    const pkgs50 = generateBenchmarkPackages(50);
    const startMem = process.memoryUsage().heapUsed;
    const start = performance.now();

    const res = packContainers(container40HC, pkgs50, { maxEvaluations: 60 });

    const elapsed = performance.now() - start;
    const memMb = (process.memoryUsage().heapUsed - startMem) / (1024 * 1024);

    console.log('=== BENCHMARK: 50 PACKAGES ===');
    console.log(`Execution Time: ${elapsed.toFixed(2)} ms`);
    console.log(`Placed: ${res.placedPackages.length}/${pkgs50.length}`);
    console.log(`Fill Rate: ${(res.fillRateBps / 100).toFixed(2)}%`);
    console.log(`CoG X: ${res.centerOfGravity.xPercentage}%`);
    console.log(`Memory Delta: ${memMb.toFixed(2)} MB`);
    console.log('==============================');
  }, 20000);

  it('Benchmark 200 packages', () => {
    const pkgs200 = generateBenchmarkPackages(200);
    const startMem = process.memoryUsage().heapUsed;
    const start = performance.now();

    const res = packContainers(container40HC, pkgs200, { maxEvaluations: 30 });

    const elapsed = performance.now() - start;
    const memMb = (process.memoryUsage().heapUsed - startMem) / (1024 * 1024);

    console.log('=== BENCHMARK: 200 PACKAGES ===');
    console.log(`Execution Time: ${elapsed.toFixed(2)} ms`);
    console.log(`Placed: ${res.placedPackages.length}/${pkgs200.length}`);
    console.log(`Fill Rate: ${(res.fillRateBps / 100).toFixed(2)}%`);
    console.log(`CoG X: ${res.centerOfGravity.xPercentage}%`);
    console.log(`Memory Delta: ${memMb.toFixed(2)} MB`);
    console.log('==============================');
  }, 20000);

  it('Benchmark 500 packages', () => {
    const pkgs500 = generateBenchmarkPackages(500);
    const startMem = process.memoryUsage().heapUsed;
    const start = performance.now();

    const res = packContainers(container40HC, pkgs500, { maxEvaluations: 20 });

    const elapsed = performance.now() - start;
    const memMb = (process.memoryUsage().heapUsed - startMem) / (1024 * 1024);

    console.log('=== BENCHMARK: 500 PACKAGES ===');
    console.log(`Execution Time: ${elapsed.toFixed(2)} ms`);
    console.log(`Placed: ${res.placedPackages.length}/${pkgs500.length}`);
    console.log(`Fill Rate: ${(res.fillRateBps / 100).toFixed(2)}%`);
    console.log(`CoG X: ${res.centerOfGravity.xPercentage}%`);
    console.log(`Memory Delta: ${memMb.toFixed(2)} MB`);
    console.log('==============================');
  }, 20000);
});
