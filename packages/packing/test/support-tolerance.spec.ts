import { describe, it, expect } from 'vitest';
import { evaluateBottomSupport, DEFAULT_CONTACT_TOLERANCE_MM } from '../src/physics/support-calc';
import { Box3D } from '../src/geometry/aabb';

describe('Support Tolerance (CONTACT_TOLERANCE_MM = 5mm)', () => {
  it('should accept two supporting boxes whose top heights differ by 3mm within 5mm tolerance', () => {
    // Box 1 has top at z = 1000 mm (z = 0, h = 1000)
    const box1: Box3D = {
      x: 0,
      y: 0,
      z: 0,
      w: 1000,
      l: 1000,
      h: 1000, // top = 1000
    };

    // Box 2 is adjacent, but slightly taller by 3mm (e.g. 3% tolerance / cardboard bulge)
    // top = 1003 mm (z = 0, h = 1003)
    const box2: Box3D = {
      x: 1000,
      y: 0,
      z: 0,
      w: 1000,
      l: 1000,
      h: 1003, // top = 1003
    };

    // Candidate box 3 placed on top at z = 1000 mm, spanning across both box 1 and box 2
    // Width = 1500 mm, Length = 800 mm
    // Overlap on box 1: [0, 1000] x [0, 800] = 1000 x 800 = 800,000 mm2
    // Overlap on box 2: [1000, 1500] x [0, 800] = 500 x 800 = 400,000 mm2
    // Total base area = 1500 x 800 = 1,200,000 mm2
    const candidate: Box3D = {
      x: 0,
      y: 0,
      z: 1000,
      w: 1500,
      l: 800,
      h: 500,
    };

    // Evaluate support with default tolerance (5mm)
    const evaluation = evaluateBottomSupport(candidate, [box1, box2], DEFAULT_CONTACT_TOLERANCE_MM);

    // Both boxes should be recognized as supporting because:
    // |1000 - 1000| = 0 <= 5mm (box1)
    // |1003 - 1000| = 3 <= 5mm (box2)
    expect(evaluation.supportingBoxIndices).toContain(0);
    expect(evaluation.supportingBoxIndices).toContain(1);
    expect(evaluation.supportingBoxIndices.length).toBe(2);

    // Total supported area = 800,000 + 400,000 = 1,200,000 (100% support)
    expect(evaluation.supportRatioBps).toBe(10000);
    expect(evaluation.isSupported).toBe(true);
  });

  it('should reject a supporting box if height difference exceeds tolerance (e.g. 8mm > 5mm)', () => {
    const box1: Box3D = {
      x: 0,
      y: 0,
      z: 0,
      w: 1000,
      l: 1000,
      h: 1000, // top = 1000
    };

    // Box 2 top = 1008 mm (|1008 - 1000| = 8mm > 5mm)
    const box2TooTall: Box3D = {
      x: 1000,
      y: 0,
      z: 0,
      w: 1000,
      l: 1000,
      h: 1008,
    };

    const candidate: Box3D = {
      x: 0,
      y: 0,
      z: 1000,
      w: 1500,
      l: 800,
      h: 500,
    };

    const evaluation = evaluateBottomSupport(candidate, [box1, box2TooTall], 5);

    // Only box 1 should be counted as supporting; box 2 is too tall
    expect(evaluation.supportingBoxIndices).toContain(0);
    expect(evaluation.supportingBoxIndices).not.toContain(1);

    // Only box 1 area is counted: 800,000 / 1,200,000 = 66.66% = 6666 bps < 8000 bps
    expect(evaluation.supportRatioBps).toBe(6666);
    expect(evaluation.isSupported).toBe(false);
  });
});
