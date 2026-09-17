import { describe, it, expect } from 'vitest';
import { StackWeightDAG } from '../src/physics/stack-weight-dag';
import { PackageItem } from '../src/geometry/types';
import { Box3D } from '../src/geometry/aabb';

describe('StackWeightDAG (Load Distribution & maxStackWeight)', () => {
  it('Case 1: Package C covers 60% of Package B top -> 100% of C weight transmits to B (c_CB = 1.0)', () => {
    const dag = new StackWeightDAG();

    // Package A at bottom: 2000x2000x500 mm, weight 200kg (200,000g)
    const pkgA: PackageItem = {
      id: 'A',
      lengthMm: 2000,
      widthMm: 2000,
      heightMm: 500,
      weightGram: 200000,
      fragile: false,
      noStack: false,
      rotatable: false,
    };
    const boxA: Box3D = { x: 0, y: 0, z: 0, w: 2000, l: 2000, h: 500 };
    dag.addPlacement(pkgA, boxA);

    // Package B on top of A: 1000x1000x500 mm, weight 100kg (100,000g)
    // Placed at (0, 0, 500). Entirely within A's top surface.
    const pkgB: PackageItem = {
      id: 'B',
      lengthMm: 1000,
      widthMm: 1000,
      heightMm: 500,
      weightGram: 100000,
      fragile: false,
      noStack: false,
      rotatable: false,
    };
    const boxB: Box3D = { x: 0, y: 0, z: 500, w: 1000, l: 1000, h: 500 };
    dag.addPlacement(pkgB, boxB);

    // Package C on top of B: 600x1000x500 mm, weight 50kg (50,000g)
    // Base area of C = 600 x 1000 = 600,000 mm2.
    // Top area of B = 1000 x 1000 = 1,000,000 mm2.
    // C covers exactly 60% of B's top surface (600,000 / 1,000,000 = 60%).
    // BUT C rests 100% on B (denominator = Area(R_C) = 600,000 mm2, c_CB = 600,000 / 600,000 = 1.0).
    const pkgC: PackageItem = {
      id: 'C',
      lengthMm: 600,
      widthMm: 1000,
      heightMm: 500,
      weightGram: 50000,
      fragile: false,
      noStack: false,
      rotatable: false,
    };
    const boxC: Box3D = { x: 0, y: 0, z: 1000, w: 600, l: 1000, h: 500 };

    const checkC = dag.canPlacePackage(pkgC, boxC);
    expect(checkC.allowed).toBe(true);

    dag.addPlacement(pkgC, boxC);

    const loads = dag.calculateCumulativeLoads();
    // loads[0] is A, loads[1] is B, loads[2] is C
    // B bears 100% of C's weight = 50,000g
    expect(loads[1]).toBe(50000);
    // A bears B's weight (100,000g) + C's weight (50,000g) = 150,000g
    expect(loads[0]).toBe(150000);
    // C is top, bears 0g
    expect(loads[2]).toBe(0);
  });

  it('Case 2: Package C bridges across B1 and B2 (60% on B1, 40% on B2) -> weight partitioned 60/40', () => {
    const dag = new StackWeightDAG();

    // Box B1 at (0, 0, 0), 1000x1000x1000 mm, weight 100kg
    const pkgB1: PackageItem = {
      id: 'B1',
      lengthMm: 1000,
      widthMm: 1000,
      heightMm: 1000,
      weightGram: 100000,
      fragile: false,
      noStack: false,
      rotatable: false,
    };
    const boxB1: Box3D = { x: 0, y: 0, z: 0, w: 1000, l: 1000, h: 1000 };
    dag.addPlacement(pkgB1, boxB1);

    // Box B2 adjacent at (1000, 0, 0), 1000x1000x1000 mm, weight 100kg
    const pkgB2: PackageItem = {
      id: 'B2',
      lengthMm: 1000,
      widthMm: 1000,
      heightMm: 1000,
      weightGram: 100000,
      fragile: false,
      noStack: false,
      rotatable: false,
    };
    const boxB2: Box3D = { x: 1000, y: 0, z: 0, w: 1000, l: 1000, h: 1000 };
    dag.addPlacement(pkgB2, boxB2);

    // Package C bridges across B1 and B2 at z = 1000 mm:
    // Placed from x = 400 to x = 1400 (length = 1000 mm, width = 1000 mm)
    // On B1: x in [400, 1000] -> width 600 mm x 1000 mm = 600,000 mm2 (60% of C's base)
    // On B2: x in [1000, 1400] -> width 400 mm x 1000 mm = 400,000 mm2 (40% of C's base)
    // Weight of C = 60,000g
    const pkgC: PackageItem = {
      id: 'C',
      lengthMm: 1000,
      widthMm: 1000,
      heightMm: 500,
      weightGram: 60000,
      fragile: false,
      noStack: false,
      rotatable: false,
    };
    const boxC: Box3D = { x: 400, y: 0, z: 1000, w: 1000, l: 1000, h: 500 };

    const checkC = dag.canPlacePackage(pkgC, boxC);
    expect(checkC.allowed).toBe(true);

    dag.addPlacement(pkgC, boxC);

    const loads = dag.calculateCumulativeLoads();
    // B1 should bear 60% of 60,000g = 36,000g
    expect(loads[0]).toBe(36000);
    // B2 should bear 40% of 60,000g = 24,000g
    expect(loads[1]).toBe(24000);
    // Total load on B1 + B2 = 60,000g (100% conserved)
    expect(loads[0] + loads[1]).toBe(60000);
  });

  it('should reject placing package on top of a package with noStack=true', () => {
    const dag = new StackWeightDAG();

    const pkgFragile: PackageItem = {
      id: 'NO_STACK_BOX',
      lengthMm: 1000,
      widthMm: 1000,
      heightMm: 1000,
      weightGram: 10000,
      fragile: true,
      noStack: true, // Cannot place anything on top!
      rotatable: false,
    };
    const boxBottom: Box3D = { x: 0, y: 0, z: 0, w: 1000, l: 1000, h: 1000 };
    dag.addPlacement(pkgFragile, boxBottom);

    const pkgTop: PackageItem = {
      id: 'HEAVY_TOP',
      lengthMm: 500,
      widthMm: 500,
      heightMm: 500,
      weightGram: 10000,
      fragile: false,
      noStack: false,
      rotatable: false,
    };
    const boxTop: Box3D = { x: 0, y: 0, z: 1000, w: 500, l: 500, h: 500 };

    const check = dag.canPlacePackage(pkgTop, boxTop);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('noStack=true');
  });

  it('should reject placing package if maxStackWeightGram is exceeded', () => {
    const dag = new StackWeightDAG();

    // Box with maxStackWeight of 20kg (20,000g)
    const pkgBottom: PackageItem = {
      id: 'WEAK_BOX',
      lengthMm: 1000,
      widthMm: 1000,
      heightMm: 1000,
      weightGram: 10000,
      fragile: false,
      noStack: false,
      maxStackWeightGram: 20000, // 20 kg max
      rotatable: false,
    };
    const boxBottom: Box3D = { x: 0, y: 0, z: 0, w: 1000, l: 1000, h: 1000 };
    dag.addPlacement(pkgBottom, boxBottom);

    // Trying to place a 30kg package on top
    const pkgHeavy: PackageItem = {
      id: 'HEAVY_BOX',
      lengthMm: 1000,
      widthMm: 1000,
      heightMm: 500,
      weightGram: 30000, // 30 kg > 20 kg max!
      fragile: false,
      noStack: false,
      rotatable: false,
    };
    const boxTop: Box3D = { x: 0, y: 0, z: 1000, w: 1000, l: 1000, h: 500 };

    const check = dag.canPlacePackage(pkgHeavy, boxTop);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('maxStackWeight exceeded');
  });
});
