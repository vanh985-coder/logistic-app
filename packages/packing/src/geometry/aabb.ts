import { PackageItem, ContainerDimension } from './types';

export interface Box3D {
  x: number;
  y: number;
  z: number;
  w: number; // length along X (container longitudinal axis)
  l: number; // width along Y (container transverse axis)
  h: number; // height along Z (container vertical axis)
}

/**
 * Returns the oriented dimensions (w, l, h) for a given rotation index (0..5).
 * 0: (L, W, H)
 * 1: (L, H, W)
 * 2: (W, L, H)
 * 3: (W, H, L)
 * 4: (H, L, W)
 * 5: (H, W, L)
 */
export function getOrientedDimensions(
  item: PackageItem,
  rotation: number,
): { w: number; l: number; h: number } {
  const L = item.lengthMm;
  const W = item.widthMm;
  const H = item.heightMm;

  if (!item.rotatable) {
    return { w: L, l: W, h: H };
  }

  switch (rotation % 6) {
    case 0:
      return { w: L, l: W, h: H };
    case 1:
      return { w: L, l: H, h: W };
    case 2:
      return { w: W, l: L, h: H };
    case 3:
      return { w: W, l: H, h: L };
    case 4:
      return { w: H, l: L, h: W };
    case 5:
      return { w: H, l: W, h: L };
    default:
      return { w: L, l: W, h: H };
  }
}

/**
 * Returns all valid rotation indices for a package.
 * If not rotatable, only [0].
 * If rotatable, [0, 1, 2, 3, 4, 5], deduplicating identical dimension orientations (e.g. cubes).
 */
export function getValidRotations(item: PackageItem): number[] {
  if (!item.rotatable) {
    return [0];
  }

  const seen = new Set<string>();
  const valid: number[] = [];

  for (let rot = 0; rot < 6; rot++) {
    const { w, l, h } = getOrientedDimensions(item, rot);
    const key = `${w}_${l}_${h}`;
    if (!seen.has(key)) {
      seen.add(key);
      valid.push(rot);
    }
  }

  return valid;
}

/**
 * Fast Axis-Aligned Bounding Box (AABB) intersection check in 3D.
 * Returns true if boxes overlap with non-zero volume.
 */
export function intersectsAABB(a: Box3D, b: Box3D): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.l &&
    a.y + a.l > b.y &&
    a.z < b.z + b.h &&
    a.z + a.h > b.z
  );
}

/**
 * Checks if a box fits entirely within container boundaries.
 */
export function isInsideContainer(box: Box3D, container: ContainerDimension): boolean {
  return (
    box.x >= 0 &&
    box.y >= 0 &&
    box.z >= 0 &&
    box.x + box.w <= container.innerLengthMm &&
    box.y + box.l <= container.innerWidthMm &&
    box.z + box.h <= container.innerHeightMm
  );
}
