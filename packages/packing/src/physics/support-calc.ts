import { Box3D } from '../geometry/aabb';

/**
 * Default contact tolerance for vertical stacking (5 mm).
 * Compensates for cardboard deflection, 3% safety margin tolerances,
 * and manufacturing variance among boxes in the same tier.
 */
export const DEFAULT_CONTACT_TOLERANCE_MM = 5;

/**
 * Minimum required bottom support ratio (80.00% = 8000 bps).
 */
export const DEFAULT_MIN_SUPPORT_RATIO_BPS = 8000;

export interface SupportEvaluation {
  isSupported: boolean;
  supportRatioBps: number; // e.g. 8500 = 85.00%
  supportingBoxIndices: number[];
  supportAreas: number[]; // intersecting area for each supporting box
}

/**
 * Evaluates whether a candidate box at (x, y, z) has adequate bottom support (>= 80%).
 * If z === 0, the package rests on the container floor (100% support).
 * If z > 0, supporting boxes are those whose top surfaces (z_j + h_j) match z within CONTACT_TOLERANCE_MM.
 */
export function evaluateBottomSupport(
  candidate: Box3D,
  placedBoxes: readonly Box3D[],
  contactToleranceMm = DEFAULT_CONTACT_TOLERANCE_MM,
  minSupportRatioBps = DEFAULT_MIN_SUPPORT_RATIO_BPS,
): SupportEvaluation {
  // Container floor provides 100% continuous support
  if (candidate.z === 0) {
    return {
      isSupported: true,
      supportRatioBps: 10000,
      supportingBoxIndices: [],
      supportAreas: [],
    };
  }

  const baseArea = candidate.w * candidate.l;
  if (baseArea <= 0) {
    return {
      isSupported: false,
      supportRatioBps: 0,
      supportingBoxIndices: [],
      supportAreas: [],
    };
  }

  const supportingBoxIndices: number[] = [];
  const supportAreas: number[] = [];
  let totalSupportArea = 0;

  for (let idx = 0; idx < placedBoxes.length; idx++) {
    const placed = placedBoxes[idx];
    const topZ = placed.z + placed.h;

    // Check vertical contact within tolerance
    if (Math.abs(topZ - candidate.z) <= contactToleranceMm) {
      // Compute 2D horizontal rectangle intersection in XY plane
      const interXMin = Math.max(candidate.x, placed.x);
      const interXMax = Math.min(candidate.x + candidate.w, placed.x + placed.w);
      const interYMin = Math.max(candidate.y, placed.y);
      const interYMax = Math.min(candidate.y + candidate.l, placed.y + placed.l);

      if (interXMax > interXMin && interYMax > interYMin) {
        const area = (interXMax - interXMin) * (interYMax - interYMin);
        totalSupportArea += area;
        supportingBoxIndices.push(idx);
        supportAreas.push(area);
      }
    }
  }

  const supportRatioBps = Math.min(
    10000,
    Math.floor((totalSupportArea * 10000) / baseArea),
  );

  return {
    isSupported: supportRatioBps >= minSupportRatioBps,
    supportRatioBps,
    supportingBoxIndices,
    supportAreas,
  };
}
