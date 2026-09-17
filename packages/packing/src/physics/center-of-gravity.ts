import { Box3D } from '../geometry/aabb';
import { PackageItem, CenterOfGravity, ContainerDimension } from '../geometry/types';

export interface PlacedItemState {
  item: PackageItem;
  box: Box3D;
  rotation: number;
}

/**
 * Calculates the 3D Center of Gravity (CoG) for a set of placed packages.
 */
export function calculateCenterOfGravity(
  placements: readonly PlacedItemState[],
  container: ContainerDimension,
): CenterOfGravity {
  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;
  let weightedZ = 0;

  for (const p of placements) {
    const w = p.item.weightGram;
    totalWeight += w;

    const centerX = p.box.x + p.box.w / 2;
    const centerY = p.box.y + p.box.l / 2;
    const centerZ = p.box.z + p.box.h / 2;

    weightedX += w * centerX;
    weightedY += w * centerY;
    weightedZ += w * centerZ;
  }

  if (totalWeight === 0) {
    return {
      xMm: Math.round(container.innerLengthMm / 2),
      yMm: Math.round(container.innerWidthMm / 2),
      zMm: 0,
      xPercentage: 50.0,
      yPercentage: 50.0,
      zPercentage: 0.0,
    };
  }

  const xMm = Math.round(weightedX / totalWeight);
  const yMm = Math.round(weightedY / totalWeight);
  const zMm = Math.round(weightedZ / totalWeight);

  const xPercentage = Number(((xMm / container.innerLengthMm) * 100).toFixed(2));
  const yPercentage = Number(((yMm / container.innerWidthMm) * 100).toFixed(2));
  const zPercentage = Number(((zMm / container.innerHeightMm) * 100).toFixed(2));

  return {
    xMm,
    yMm,
    zMm,
    xPercentage,
    yPercentage,
    zPercentage,
  };
}

/**
 * CoG Repair Step:
 * If the final CoG is outside the maritime CTU standard [45.0%, 55.0%],
 * performs targeted longitudinal adjustments (swaps/shifts of heavy packages)
 * to bring CoG into the target safety corridor.
 */
export function repairCenterOfGravity(
  placements: PlacedItemState[],
  container: ContainerDimension,
  canPlaceCheck: (testPlacements: PlacedItemState[]) => boolean,
  maxAttempts = 50,
): { success: boolean; cog: CenterOfGravity } {
  let currentCog = calculateCenterOfGravity(placements, container);

  if (currentCog.xPercentage >= 45.0 && currentCog.xPercentage <= 55.0) {
    return { success: true, cog: currentCog };
  }

  // Attempt targeted swaps between packages on the heavier side and lighter side
  const midX = container.innerLengthMm / 2;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const needShiftRight = currentCog.xPercentage < 45.0; // mass too far back (low X)
    const needShiftLeft = currentCog.xPercentage > 55.0; // mass too far forward (high X)

    if (!needShiftRight && !needShiftLeft) {
      return { success: true, cog: currentCog };
    }

    // Find candidates for swapping
    let bestSwap: [number, number] | null = null;
    let bestImprovement = 0;

    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const p1 = placements[i];
        const p2 = placements[j];

        // Check if swapping would help longitudinal balance
        const p1IsLeft = p1.box.x + p1.box.w / 2 < midX;
        const p2IsLeft = p2.box.x + p2.box.w / 2 < midX;

        if (p1IsLeft === p2IsLeft) continue; // Same side doesn't change longitudinal balance

        const left = p1IsLeft ? p1 : p2;
        const right = p1IsLeft ? p2 : p1;
        const leftIdx = p1IsLeft ? i : j;
        const rightIdx = p1IsLeft ? j : i;

        // If we need shift right (+X), left package should be heavier than right
        if (needShiftRight && left.item.weightGram <= right.item.weightGram) continue;
        // If we need shift left (-X), right package should be heavier than left
        if (needShiftLeft && right.item.weightGram <= left.item.weightGram) continue;

        // Check dimensional compatibility: identical or very close dimensions
        const dimMatch =
          Math.abs(left.box.w - right.box.w) <= 10 &&
          Math.abs(left.box.l - right.box.l) <= 10 &&
          Math.abs(left.box.h - right.box.h) <= 10;

        if (dimMatch) {
          const deltaWeight = Math.abs(left.item.weightGram - right.item.weightGram);
          if (deltaWeight > bestImprovement) {
            // Test swap validity
            const originalLeftBox = { ...left.box };
            const originalRightBox = { ...right.box };

            left.box.x = originalRightBox.x;
            left.box.y = originalRightBox.y;
            left.box.z = originalRightBox.z;

            right.box.x = originalLeftBox.x;
            right.box.y = originalLeftBox.y;
            right.box.z = originalLeftBox.z;

            const isValid = canPlaceCheck(placements);

            // Revert for now
            left.box = originalLeftBox;
            right.box = originalRightBox;

            if (isValid) {
              bestImprovement = deltaWeight;
              bestSwap = [leftIdx, rightIdx];
            }
          }
        }
      }
    }

    if (!bestSwap) break; // No more beneficial valid swaps found

    // Execute best swap
    const [idx1, idx2] = bestSwap;
    const b1 = { ...placements[idx1].box };
    const b2 = { ...placements[idx2].box };

    placements[idx1].box.x = b2.x;
    placements[idx1].box.y = b2.y;
    placements[idx1].box.z = b2.z;

    placements[idx2].box.x = b1.x;
    placements[idx2].box.y = b1.y;
    placements[idx2].box.z = b1.z;

    currentCog = calculateCenterOfGravity(placements, container);
    if (currentCog.xPercentage >= 45.0 && currentCog.xPercentage <= 55.0) {
      return { success: true, cog: currentCog };
    }
  }

  return {
    success: currentCog.xPercentage >= 45.0 && currentCog.xPercentage <= 55.0,
    cog: currentCog,
  };
}
