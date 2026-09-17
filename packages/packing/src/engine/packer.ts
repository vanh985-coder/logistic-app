import {
  ContainerDimension,
  PackageItem,
  PackedPlacement,
  UnplacedPackage,
  PackingOptions,
  PackingResult,
} from '../geometry/types';
import { Box3D, getOrientedDimensions, getValidRotations, isInsideContainer } from '../geometry/aabb';
import { VoxelGrid3D } from '../geometry/voxel-grid';
import { ExtremePointsManager } from '../geometry/extreme-points';
import { evaluateBottomSupport, DEFAULT_CONTACT_TOLERANCE_MM } from '../physics/support-calc';
import { StackWeightDAG } from '../physics/stack-weight-dag';
import {
  calculateCenterOfGravity,
  repairCenterOfGravity,
  PlacedItemState,
} from '../physics/center-of-gravity';
import { SeededRandom, computeFingerprintSeed } from '../prng/seeded-random';

interface CandidateScore {
  pointIndex: number;
  rotation: number;
  score: number;
  box: Box3D;
}

export class ExtremePointPacker {
  private readonly container: ContainerDimension;
  private readonly options: Required<PackingOptions>;
  private readonly rng: SeededRandom;

  constructor(container: ContainerDimension, options?: PackingOptions) {
    this.container = container;
    const seed =
      options?.seed !== undefined
        ? options.seed
        : computeFingerprintSeed(
            `${container.innerLengthMm}_${container.innerWidthMm}_${container.innerHeightMm}_${container.maxPayloadGram}`,
          );

    this.options = {
      timeBudgetMs: options?.timeBudgetMs ?? 8000,
      seed,
      maxEvaluations: options?.maxEvaluations ?? 2000,
      contactToleranceMm: options?.contactToleranceMm ?? DEFAULT_CONTACT_TOLERANCE_MM,
      minSupportRatioBps: options?.minSupportRatioBps ?? 8000,
    };

    this.rng = new SeededRandom(this.options.seed);
  }

  /**
   * Packs packages into container deterministically.
   */
  pack(packages: PackageItem[]): PackingResult {
    const startTime = Date.now();
    const containerVolume =
      BigInt(this.container.innerLengthMm) *
      BigInt(this.container.innerWidthMm) *
      BigInt(this.container.innerHeightMm);

    if (packages.length === 0) {
      return {
        fillRateBps: 0,
        centerOfGravity: {
          xMm: Math.round(this.container.innerLengthMm / 2),
          yMm: Math.round(this.container.innerWidthMm / 2),
          zMm: 0,
          xPercentage: 50.0,
          yPercentage: 50.0,
          zPercentage: 0.0,
        },
        placedPackages: [],
        unplacedPackages: [],
        executionTimeMs: Date.now() - startTime,
        algorithmVersion: '4.0.0-ep-engine',
        cogViolation: false,
        totalWeightGrams: 0,
        totalVolumeMm3: '0',
        iterationsExecuted: 0,
      };
    }

    // Filter out packages that cannot fit in any orientation or exceed container payload alone
    const eligiblePackages: PackageItem[] = [];
    const initiallyUnplaced: UnplacedPackage[] = [];

    for (const pkg of packages) {
      if (pkg.weightGram > this.container.maxPayloadGram) {
        initiallyUnplaced.push({ packageId: pkg.id, reason: 'EXCEED_PAYLOAD' });
        continue;
      }

      const rotations = getValidRotations(pkg);
      let canFitAny = false;
      for (const rot of rotations) {
        const { w, l, h } = getOrientedDimensions(pkg, rot);
        if (
          w <= this.container.innerLengthMm &&
          l <= this.container.innerWidthMm &&
          h <= this.container.innerHeightMm
        ) {
          canFitAny = true;
          break;
        }
      }

      if (!canFitAny) {
        initiallyUnplaced.push({ packageId: pkg.id, reason: 'EXCEED_DIMENSIONS' });
      } else {
        eligiblePackages.push(pkg);
      }
    }

    // Generate deterministic sorting permutations (Heuristics)
    const permutations = this.generateOrderings(eligiblePackages);

    let bestPlacements: PlacedItemState[] = [];
    let bestVolume = 0n;
    let bestWeight = 0;
    let iterations = 0;

    for (const orderedList of permutations) {
      if (iterations >= this.options.maxEvaluations) break;
      // Watchdog emergency timeout check
      if (Date.now() - startTime >= this.options.timeBudgetMs) break;

      iterations++;
      const result = this.packSinglePass(orderedList);

      if (result.totalVolume > bestVolume) {
        bestVolume = result.totalVolume;
        bestWeight = result.totalWeight;
        bestPlacements = result.placements;
      }
    }

    // Post-Placement CoG Check & Repair Step
    const checkPlacementsValidity = (testPlacements: PlacedItemState[]): boolean => {
      const tempGrid = new VoxelGrid3D();
      const tempDag = new StackWeightDAG();

      for (const p of testPlacements) {
        if (!isInsideContainer(p.box, this.container)) return false;
        if (tempGrid.hasCollision(p.box)) return false;

        const supEval = evaluateBottomSupport(
          p.box,
          tempGrid.getAllBoxes(),
          this.options.contactToleranceMm,
          this.options.minSupportRatioBps,
        );
        if (!supEval.isSupported) return false;

        const dagEval = tempDag.canPlacePackage(
          p.item,
          p.box,
          this.options.contactToleranceMm,
        );
        if (!dagEval.allowed) return false;

        tempGrid.insert(p.box);
        tempDag.addPlacement(p.item, p.box, this.options.contactToleranceMm);
      }
      return true;
    };

    const repairRes = repairCenterOfGravity(
      bestPlacements,
      this.container,
      checkPlacementsValidity,
      50,
    );

    const placedIds = new Set(bestPlacements.map((p) => p.item.id));
    const allUnplaced: UnplacedPackage[] = [
      ...initiallyUnplaced,
      ...eligiblePackages
        .filter((p) => !placedIds.has(p.id))
        .map((p) => ({ packageId: p.id, reason: 'NO_VALID_PLACEMENT' as const })),
    ];

    const fillRateBps =
      containerVolume > 0n ? Number((bestVolume * 10000n) / containerVolume) : 0;

    const cogViolation =
      repairRes.cog.xPercentage < 45.0 || repairRes.cog.xPercentage > 55.0;

    const formattedPlacements: PackedPlacement[] = bestPlacements.map((p) => ({
      packageId: p.item.id,
      xMm: p.box.x,
      yMm: p.box.y,
      zMm: p.box.z,
      placedLengthMm: p.box.w,
      placedWidthMm: p.box.l,
      placedHeightMm: p.box.h,
      rotation: p.rotation,
      layerIndex: Math.floor(p.box.z / 500),
    }));

    return {
      fillRateBps,
      centerOfGravity: repairRes.cog,
      placedPackages: formattedPlacements,
      unplacedPackages: allUnplaced,
      executionTimeMs: Date.now() - startTime,
      algorithmVersion: '4.0.0-ep-engine',
      cogViolation,
      cogWarning: cogViolation
        ? `Longitudinal center of gravity at ${repairRes.cog.xPercentage}% is outside the [45%, 55%] safety range`
        : undefined,
      totalWeightGrams: bestWeight,
      totalVolumeMm3: bestVolume.toString(),
      iterationsExecuted: iterations,
    };
  }

  /**
   * Executes a single constructive packing pass using Extreme Points.
   */
  private packSinglePass(items: PackageItem[]): {
    placements: PlacedItemState[];
    totalVolume: bigint;
    totalWeight: number;
  } {
    const epManager = new ExtremePointsManager();
    const voxelGrid = new VoxelGrid3D();
    const stackDag = new StackWeightDAG();

    const placements: PlacedItemState[] = [];
    let totalVolume = 0n;
    let totalWeight = 0;

    const maxDrop = Math.max(...items.map((i) => i.dropOrder ?? 1), 1);

    for (const item of items) {
      if (totalWeight + item.weightGram > this.container.maxPayloadGram) {
        continue;
      }

      const candidateScores: CandidateScore[] = [];
      const rotations = getValidRotations(item);
      const points = epManager.getPoints();

      for (let pIdx = 0; pIdx < points.length; pIdx++) {
        const p = points[pIdx];

        for (const rot of rotations) {
          const dims = getOrientedDimensions(item, rot);
          const candidateBox: Box3D = {
            x: p.x,
            y: p.y,
            z: p.z,
            w: dims.w,
            l: dims.l,
            h: dims.h,
          };

          // 1. Boundary check
          if (!isInsideContainer(candidateBox, this.container)) continue;

          // 2. Collision check
          if (voxelGrid.hasCollision(candidateBox)) continue;

          // 3. Bottom support check (>= 80%, contact tolerance 5mm)
          const supportEval = evaluateBottomSupport(
            candidateBox,
            voxelGrid.getAllBoxes(),
            this.options.contactToleranceMm,
            this.options.minSupportRatioBps,
          );
          if (!supportEval.isSupported) continue;

          // 4. Stacking weight limit check & noStack constraint
          const dagCheck = stackDag.canPlacePackage(
            item,
            candidateBox,
            this.options.contactToleranceMm,
          );
          if (!dagCheck.allowed) continue;

          // 5. Compute placement evaluation score
          const score = this.calculatePlacementScore(
            candidateBox,
            item,
            maxDrop,
            supportEval.supportRatioBps,
            placements,
          );

          candidateScores.push({
            pointIndex: pIdx,
            rotation: rot,
            score,
            box: candidateBox,
          });
        }
      }

      if (candidateScores.length > 0) {
        // Pick best score
        candidateScores.sort((a, b) => b.score - a.score);
        const best = candidateScores[0];

        voxelGrid.insert(best.box);
        epManager.update(
          best.box,
          voxelGrid.getAllBoxes(),
          this.container,
          this.options.contactToleranceMm,
        );
        stackDag.addPlacement(item, best.box, this.options.contactToleranceMm);

        placements.push({
          item,
          box: best.box,
          rotation: best.rotation,
        });

        totalVolume += BigInt(best.box.w) * BigInt(best.box.l) * BigInt(best.box.h);
        totalWeight += item.weightGram;
      }
    }

    return {
      placements,
      totalVolume,
      totalWeight,
    };
  }

  /**
   * Placement evaluation scoring function.
   * Balances compactness, soft CoG attraction to center, LIFO ordering, and support firmness.
   */
  private calculatePlacementScore(
    box: Box3D,
    item: PackageItem,
    maxDrop: number,
    supportRatioBps: number,
    currentPlacements: readonly PlacedItemState[],
  ): number {
    const L = this.container.innerLengthMm;
    const W = this.container.innerWidthMm;
    const H = this.container.innerHeightMm;

    // 1. Compactness: Prioritize lowest Z, then deepest X (from back wall to doors), then tightest Y
    const fCompact = - (3.0 * (box.z / H) + 2.0 * (box.x / L) + 1.0 * (box.y / W));

    // 2. Soft CoG Pull: evaluate where CoG would move
    const testPlacements = [...currentPlacements, { item, box, rotation: 0 }];
    const cog = calculateCenterOfGravity(testPlacements, this.container);
    const fCog = - Math.abs(cog.xPercentage / 100 - 0.5);

    // 3. LIFO bonus: early drop packages are rewarded when closer to doors (+X)
    const drop = item.dropOrder ?? 1;
    const dropPriority = (maxDrop - drop + 1) / maxDrop;
    const fLifo = ((box.x + box.w) / L) * dropPriority;

    // 4. Support bonus: higher contact ratio is preferred
    const fSupport = supportRatioBps / 10000;

    return 1000 * fCompact + 2500 * fCog + 800 * fLifo + 500 * fSupport;
  }

  /**
   * Generates deterministic permutations and sortings of package items.
   */
  private generateOrderings(items: PackageItem[]): PackageItem[][] {
    const orderings: PackageItem[][] = [];

    // Heuristic 1: Volume descending (Best Fit)
    orderings.push(
      [...items].sort((a, b) => {
        const va = BigInt(a.lengthMm) * BigInt(a.widthMm) * BigInt(a.heightMm);
        const vb = BigInt(b.lengthMm) * BigInt(b.widthMm) * BigInt(b.heightMm);
        if (vb > va) return 1;
        if (vb < va) return -1;
        return b.weightGram - a.weightGram;
      }),
    );

    // Heuristic 2: Weight descending (heavy on bottom)
    orderings.push(
      [...items].sort((a, b) => {
        if (b.weightGram !== a.weightGram) return b.weightGram - a.weightGram;
        const va = a.lengthMm * a.widthMm * a.heightMm;
        const vb = b.lengthMm * b.widthMm * b.heightMm;
        return vb - va;
      }),
    );

    // Heuristic 3: Max base area descending (w * l)
    orderings.push(
      [...items].sort((a, b) => {
        const baseA = Math.max(a.lengthMm * a.widthMm, a.lengthMm * a.heightMm, a.widthMm * a.heightMm);
        const baseB = Math.max(b.lengthMm * b.widthMm, b.lengthMm * b.heightMm, b.widthMm * b.heightMm);
        return baseB - baseA;
      }),
    );

    // Heuristic 4: DropOrder ascending, then volume descending
    orderings.push(
      [...items].sort((a, b) => {
        const da = a.dropOrder ?? 1;
        const db = b.dropOrder ?? 1;
        if (da !== db) return da - db;
        const va = a.lengthMm * a.widthMm * a.heightMm;
        const vb = b.lengthMm * b.widthMm * b.heightMm;
        return vb - va;
      }),
    );

    // Further permutations via deterministic seeded shuffle
    const baseList = [...orderings[0]];
    for (let i = 0; i < 60; i++) {
      const copy = [...baseList];
      // Random windowed perturbation
      const windowSize = Math.min(5, copy.length);
      for (let j = 0; j < copy.length - windowSize; j += windowSize) {
        const slice = copy.slice(j, j + windowSize);
        this.rng.shuffle(slice);
        copy.splice(j, windowSize, ...slice);
      }
      orderings.push(copy);
    }

    return orderings;
  }
}

/**
 * Top-level pure function to pack packages into a container.
 */
export function packContainers(
  container: ContainerDimension,
  packages: PackageItem[],
  options?: PackingOptions,
): PackingResult {
  const packer = new ExtremePointPacker(container, options);
  return packer.pack(packages);
}
