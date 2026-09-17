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
export interface CoGRepairResult {
  success: boolean;
  cog: CenterOfGravity;
  repairStepsExecuted: number;
  repairApplied: boolean;
  repairType?: 'BLOCK_LONGITUDINAL_SHIFT' | 'PACKAGE_SHIFT' | 'SWAP' | 'NONE';
}

/**
 * CoG Repair Step:
 * If the final CoG is outside the maritime CTU standard [45.0%, 55.0%],
 * performs targeted longitudinal adjustments:
 * 1. Block Longitudinal Shift: If there is free longitudinal slack, shifts the entire cargo group along X to center it.
 * 2. Targeted Swaps: Swaps pairs of heavy/light packages across the longitudinal midpoint.
 * 3. Individual Package Shifts: Slides unblocked packages along X towards target center.
 */
export function repairCenterOfGravity(
  placements: PlacedItemState[],
  container: ContainerDimension,
  canPlaceCheck: (testPlacements: PlacedItemState[]) => boolean,
  maxAttempts = 50,
): CoGRepairResult {
  let currentCog = calculateCenterOfGravity(placements, container);

  if (currentCog.xPercentage >= 45.0 && currentCog.xPercentage <= 55.0) {
    return {
      success: true,
      cog: currentCog,
      repairStepsExecuted: 0,
      repairApplied: false,
      repairType: 'NONE',
    };
  }

  if (placements.length === 0) {
    return {
      success: true,
      cog: currentCog,
      repairStepsExecuted: 0,
      repairApplied: false,
      repairType: 'NONE',
    };
  }

  let stepsExecuted = 0;

  // -------------------------------------------------------------
  // TIER 2A: Block Longitudinal Shift
  // If the entire cargo block has room to slide along X, shift it
  // directly toward the 50.0% midpoint.
  // -------------------------------------------------------------
  const targetMidX = Math.round(container.innerLengthMm / 2);
  const deltaX = targetMidX - currentCog.xMm;

  if (deltaX !== 0) {
    stepsExecuted++;
    if (deltaX > 0) {
      // Mass is too close to front (x=0, CoG < 45%). Need to shift towards doors (+X).
      const maxX = Math.max(...placements.map((p) => p.box.x + p.box.w));
      const slackX = container.innerLengthMm - maxX;
      if (slackX > 0) {
        const shift = Math.min(deltaX, slackX);
        if (shift > 0) {
          for (const p of placements) p.box.x += shift;
          if (canPlaceCheck(placements)) {
            currentCog = calculateCenterOfGravity(placements, container);
            if (currentCog.xPercentage >= 45.0 && currentCog.xPercentage <= 55.0) {
              return {
                success: true,
                cog: currentCog,
                repairStepsExecuted: stepsExecuted,
                repairApplied: true,
                repairType: 'BLOCK_LONGITUDINAL_SHIFT',
              };
            }
          } else {
            // Revert if invalid
            for (const p of placements) p.box.x -= shift;
          }
        }
      }
    } else {
      // Mass is too close to doors (CoG > 55%). Need to shift towards front (-X).
      const minX = Math.min(...placements.map((p) => p.box.x));
      if (minX > 0) {
        const shift = Math.min(Math.abs(deltaX), minX);
        if (shift > 0) {
          for (const p of placements) p.box.x -= shift;
          if (canPlaceCheck(placements)) {
            currentCog = calculateCenterOfGravity(placements, container);
            if (currentCog.xPercentage >= 45.0 && currentCog.xPercentage <= 55.0) {
              return {
                success: true,
                cog: currentCog,
                repairStepsExecuted: stepsExecuted,
                repairApplied: true,
                repairType: 'BLOCK_LONGITUDINAL_SHIFT',
              };
            }
          } else {
            // Revert if invalid
            for (const p of placements) p.box.x += shift;
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // TIER 2B: Targeted Swaps
  // Swaps pairs of heavy/light packages with matching dimensions
  // across the midpoint.
  // -------------------------------------------------------------
  const midX = container.innerLengthMm / 2;
  let swapApplied = false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    stepsExecuted++;
    const needShiftRight = currentCog.xPercentage < 45.0; // mass too far back (low X)
    const needShiftLeft = currentCog.xPercentage > 55.0; // mass too far forward (high X)

    if (!needShiftRight && !needShiftLeft) {
      return {
        success: true,
        cog: currentCog,
        repairStepsExecuted: stepsExecuted,
        repairApplied: swapApplied,
        repairType: swapApplied ? 'SWAP' : 'NONE',
      };
    }

    let bestSwap: [number, number] | null = null;
    let bestImprovement = 0;

    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const p1 = placements[i];
        const p2 = placements[j];

        const p1IsLeft = p1.box.x + p1.box.w / 2 < midX;
        const p2IsLeft = p2.box.x + p2.box.w / 2 < midX;

        if (p1IsLeft === p2IsLeft) continue;

        const left = p1IsLeft ? p1 : p2;
        const right = p1IsLeft ? p2 : p1;
        const leftIdx = p1IsLeft ? i : j;
        const rightIdx = p1IsLeft ? j : i;

        if (needShiftRight && left.item.weightGram <= right.item.weightGram) continue;
        if (needShiftLeft && right.item.weightGram <= left.item.weightGram) continue;

        const dimMatch =
          Math.abs(left.box.w - right.box.w) <= 10 &&
          Math.abs(left.box.l - right.box.l) <= 10 &&
          Math.abs(left.box.h - right.box.h) <= 10;

        if (dimMatch) {
          const deltaWeight = Math.abs(left.item.weightGram - right.item.weightGram);
          if (deltaWeight > bestImprovement) {
            const originalLeftBox = { ...left.box };
            const originalRightBox = { ...right.box };

            left.box.x = originalRightBox.x;
            left.box.y = originalRightBox.y;
            left.box.z = originalRightBox.z;

            right.box.x = originalLeftBox.x;
            right.box.y = originalLeftBox.y;
            right.box.z = originalLeftBox.z;

            const isValid = canPlaceCheck(placements);

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

    if (!bestSwap) break;

    const [idx1, idx2] = bestSwap;
    const b1 = { ...placements[idx1].box };
    const b2 = { ...placements[idx2].box };

    placements[idx1].box.x = b2.x;
    placements[idx1].box.y = b2.y;
    placements[idx1].box.z = b2.z;

    placements[idx2].box.x = b1.x;
    placements[idx2].box.y = b1.y;
    placements[idx2].box.z = b1.z;

    swapApplied = true;
    currentCog = calculateCenterOfGravity(placements, container);
    if (currentCog.xPercentage >= 45.0 && currentCog.xPercentage <= 55.0) {
      return {
        success: true,
        cog: currentCog,
        repairStepsExecuted: stepsExecuted,
        repairApplied: true,
        repairType: 'SWAP',
      };
    }
  }

  // -------------------------------------------------------------
  // TIER 2C: Individual Package Shifts
  // If CoG is still out of range, slide individual unblocked packages
  // along X into open spaces towards the center.
  // -------------------------------------------------------------
  let shiftApplied = false;
  if (currentCog.xPercentage < 45.0 || currentCog.xPercentage > 55.0) {
    const needShiftRight = currentCog.xPercentage < 45.0;

    // Sort candidate packages to shift: heaviest first
    const candidates = [...placements]
      .filter((p) => (needShiftRight ? p.box.x + p.box.w / 2 < midX : p.box.x + p.box.w / 2 > midX))
      .sort((a, b) => b.item.weightGram - a.item.weightGram);

    for (const p of candidates) {
      if (currentCog.xPercentage >= 45.0 && currentCog.xPercentage <= 55.0) break;
      stepsExecuted++;

      const origX = p.box.x;
      const stepDirection = needShiftRight ? 1 : -1;
      const stepSizes = [6000, 5000, 4000, 3000, 2000, 1500, 1000, 500, 250, 100];

      for (const step of stepSizes) {
        const testX = origX + stepDirection * step;
        if (testX < 0 || testX + p.box.w > container.innerLengthMm) continue;

        p.box.x = testX;
        if (canPlaceCheck(placements)) {
          const newCog = calculateCenterOfGravity(placements, container);
          if (Math.abs(newCog.xPercentage - 50.0) < Math.abs(currentCog.xPercentage - 50.0)) {
            currentCog = newCog;
            shiftApplied = true;
            break; // keep this shift
          }
        }
        p.box.x = origX; // revert
      }
    }

    if (shiftApplied && currentCog.xPercentage >= 45.0 && currentCog.xPercentage <= 55.0) {
      return {
        success: true,
        cog: currentCog,
        repairStepsExecuted: stepsExecuted,
        repairApplied: true,
        repairType: 'PACKAGE_SHIFT',
      };
    }
  }

  const anyApplied = swapApplied || shiftApplied;
  return {
    success: currentCog.xPercentage >= 45.0 && currentCog.xPercentage <= 55.0,
    cog: currentCog,
    repairStepsExecuted: stepsExecuted,
    repairApplied: anyApplied,
    repairType: swapApplied ? 'SWAP' : shiftApplied ? 'PACKAGE_SHIFT' : 'NONE',
  };
}

