import { Box3D, intersectsAABB } from './aabb';

/**
 * 3D Spatial Grid / Voxel Hash for O(1) broad-phase collision detection.
 * Avoids O(N) linear scans against all placed packages.
 */
export class VoxelGrid3D {
  private readonly cellSize: number;
  private readonly grid: Map<number, number[]>; // cellHash -> array of placed box indices
  private readonly placedBoxes: Box3D[];

  constructor(cellSizeMm = 250) {
    this.cellSize = cellSizeMm;
    this.grid = new Map();
    this.placedBoxes = [];
  }

  private cellCoord(val: number): number {
    return Math.floor(val / this.cellSize);
  }

  private hashCell(cx: number, cy: number, cz: number): number {
    // 3D Morton-like prime hashing
    return (((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) >>> 0);
  }

  /**
   * Inserts a placed box into the spatial grid.
   */
  insert(box: Box3D): number {
    const boxIndex = this.placedBoxes.length;
    this.placedBoxes.push(box);

    const minCx = this.cellCoord(box.x);
    const maxCx = this.cellCoord(box.x + box.w - 1);
    const minCy = this.cellCoord(box.y);
    const maxCy = this.cellCoord(box.y + box.l - 1);
    const minCz = this.cellCoord(box.z);
    const maxCz = this.cellCoord(box.z + box.h - 1);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cz = minCz; cz <= maxCz; cz++) {
          const hash = this.hashCell(cx, cy, cz);
          let cell = this.grid.get(hash);
          if (!cell) {
            cell = [];
            this.grid.set(hash, cell);
          }
          cell.push(boxIndex);
        }
      }
    }

    return boxIndex;
  }

  /**
   * Fast collision check: returns true if candidate box collides with any placed box.
   */
  hasCollision(candidate: Box3D): boolean {
    const minCx = this.cellCoord(candidate.x);
    const maxCx = this.cellCoord(candidate.x + candidate.w - 1);
    const minCy = this.cellCoord(candidate.y);
    const maxCy = this.cellCoord(candidate.y + candidate.l - 1);
    const minCz = this.cellCoord(candidate.z);
    const maxCz = this.cellCoord(candidate.z + candidate.h - 1);

    const testedIndices = new Set<number>();

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cz = minCz; cz <= maxCz; cz++) {
          const hash = this.hashCell(cx, cy, cz);
          const cell = this.grid.get(hash);
          if (!cell) continue;

          for (const boxIdx of cell) {
            if (testedIndices.has(boxIdx)) continue;
            testedIndices.add(boxIdx);

            if (intersectsAABB(candidate, this.placedBoxes[boxIdx])) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Returns all placed boxes.
   */
  getAllBoxes(): readonly Box3D[] {
    return this.placedBoxes;
  }

  /**
   * Clears all boxes and grid data.
   */
  clear(): void {
    this.grid.clear();
    this.placedBoxes.length = 0;
  }
}
