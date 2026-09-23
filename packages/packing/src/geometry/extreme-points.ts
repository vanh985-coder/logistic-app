import { Box3D } from './aabb';
import { ContainerDimension } from './types';
import { DEFAULT_CONTACT_TOLERANCE_MM } from '../physics/support-calc';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Extreme Point manager for 3D container packing.
 * Implements Crainic et al. (2008) EP generation, projection, and domination elimination.
 */
export class ExtremePointsManager {
  private points: Point3D[] = [];

  constructor() {
    this.reset();
  }

  reset(): void {
    this.points = [{ x: 0, y: 0, z: 0 }];
  }

  getPoints(): readonly Point3D[] {
    return this.points;
  }

  /**
   * Updates extreme points after placing a new box.
   */
  update(
    newBox: Box3D,
    allBoxes: readonly Box3D[],
    container: ContainerDimension,
    contactToleranceMm = DEFAULT_CONTACT_TOLERANCE_MM,
  ): void {
    const candidatePoints: Point3D[] = [];

    // 1. Direct faces of the new box
    candidatePoints.push({ x: newBox.x + newBox.w, y: newBox.y, z: newBox.z });
    candidatePoints.push({ x: newBox.x, y: newBox.y + newBox.l, z: newBox.z });
    candidatePoints.push({ x: newBox.x, y: newBox.y, z: newBox.z + newBox.h });

    // 2. Additional corners of newBox on upper plane
    candidatePoints.push({ x: newBox.x + newBox.w, y: newBox.y, z: newBox.z + newBox.h });
    candidatePoints.push({ x: newBox.x, y: newBox.y + newBox.l, z: newBox.z + newBox.h });

    // 3. Projected points against existing boxes in 3D
    for (const b of allBoxes) {
      // Projection along X
      if (b.x + b.w <= newBox.x + newBox.w && b.y < newBox.y + newBox.l && b.y + b.l > newBox.y) {
        candidatePoints.push({ x: newBox.x + newBox.w, y: b.y + b.l, z: newBox.z });
        candidatePoints.push({ x: newBox.x + newBox.w, y: b.y + b.l, z: newBox.z + newBox.h });
      }
      // Projection along Y
      if (b.y + b.l <= newBox.y + newBox.l && b.x < newBox.x + newBox.w && b.x + b.w > newBox.x) {
        candidatePoints.push({ x: b.x + b.w, y: newBox.y + newBox.l, z: newBox.z });
        candidatePoints.push({ x: b.x + b.w, y: newBox.y + newBox.l, z: newBox.z + newBox.h });
      }
      // Projection along Z
      if (b.z + b.h <= newBox.z + newBox.h && b.x < newBox.x + newBox.w && b.x + b.w > newBox.x) {
        candidatePoints.push({ x: b.x + b.w, y: newBox.y, z: b.z + b.h });
        candidatePoints.push({ x: newBox.x, y: b.y + b.l, z: b.z + b.h });
      }
      // On top of newBox: projections of existing boxes with matching top heights
      if (Math.abs(b.z + b.h - (newBox.z + newBox.h)) <= contactToleranceMm) {
        candidatePoints.push({ x: b.x + b.w, y: newBox.y, z: newBox.z + newBox.h });
        candidatePoints.push({ x: newBox.x, y: b.y + b.l, z: newBox.z + newBox.h });
      }
    }

    // Combine existing points and new candidates
    const combined = [...this.points, ...candidatePoints];

    // Filter points
    const validPoints: Point3D[] = [];
    const seen = new Set<string>();

    for (const p of combined) {
      // 1. Container boundaries
      if (
        p.x < 0 ||
        p.y < 0 ||
        p.z < 0 ||
        p.x >= container.innerLengthMm ||
        p.y >= container.innerWidthMm ||
        p.z >= container.innerHeightMm
      ) {
        continue;
      }

      // 2. Inside any placed box
      let isInside = false;
      for (const b of allBoxes) {
        if (
          p.x >= b.x &&
          p.x < b.x + b.w &&
          p.y >= b.y &&
          p.y < b.y + b.l &&
          p.z >= b.z &&
          p.z < b.z + b.h
        ) {
          isInside = true;
          break;
        }
      }
      if (isInside) continue;

      // 3. Floating points: if z > 0, point must have underlying support
      if (p.z > 0) {
        let hasSupport = false;
        for (const b of allBoxes) {
          if (
            Math.abs(b.z + b.h - p.z) <= contactToleranceMm &&
            p.x >= b.x &&
            p.x <= b.x + b.w &&
            p.y >= b.y &&
            p.y <= b.y + b.l
          ) {
            hasSupport = true;
            break;
          }
        }
        if (!hasSupport) continue;
      }

      // 4. Deduplication
      const key = `${p.x}_${p.y}_${p.z}`;
      if (!seen.has(key)) {
        seen.add(key);
        validPoints.push(p);
      }
    }

    // Sort points: Z ascending (bottom first), X ascending (deep wall out to doors), Y ascending
    validPoints.sort((a, b) => {
      if (a.z !== b.z) return a.z - b.z;
      if (a.x !== b.x) return a.x - b.x;
      return a.y - b.y;
    });

    this.points = validPoints;
  }
}
