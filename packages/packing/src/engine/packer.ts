import {
  ContainerDimension,
  PackageItem,
  PackedPlacement,
  UnplacedPackage,
  PackingOptions,
  PackingResult,
  PackingStrategy,
  MultiStrategyPackingResult,
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
import {
  evaluateStrategyCriteria,
  evaluateAccessibility,
  evaluateLifo,
  PlacedPackageWithBox,
} from '../evaluation/criteria';

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
      strategy: options?.strategy ?? 'MAX_VOLUME',
      timeBudgetMs: options?.timeBudgetMs ?? 8000,
      seed,
      maxEvaluations: options?.maxEvaluations ?? 8,
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
      const emptyResult: PackingResult = {
        strategy: this.options.strategy,
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
        watchdogTriggered: false,
      };
      emptyResult.evaluation = evaluateStrategyCriteria(
        this.container,
        packages,
        emptyResult,
        this.options.strategy,
      );
      return emptyResult;
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

    const minDims = eligiblePackages
      .map((p) => Math.min(p.lengthMm, p.widthMm, p.heightMm))
      .sort((a, b) => a - b);
    const typicalMinDim =
      minDims.length > 0 ? minDims[Math.floor(minDims.length * 0.2)] : 500;

    // Generate deterministic sorting permutations (Heuristics)
    const permutations = this.generateOrderings(eligiblePackages, typicalMinDim);

    let bestPlacements: PlacedItemState[] = [];
    let bestScore = -Infinity;
    let bestVolume = 0n;
    let bestWeight = 0;
    let bestUnplacedReasons = new Map<string, UnplacedPackage['reason']>();
    let bestRejectionStats = {
      boundaryExceeded: 0,
      collision: 0,
      insufficientSupport: 0,
      maxStackWeight: 0,
      payloadExceeded: 0,
      dimensionsExceeded: initiallyUnplaced.filter((u) => u.reason === 'EXCEED_DIMENSIONS').length,
    };
    let iterations = 0;
    let watchdogTriggered = false;

    for (const orderedList of permutations) {
      if (iterations >= this.options.maxEvaluations) break;
      // Watchdog emergency timeout check
      if (Date.now() - startTime >= this.options.timeBudgetMs) {
        watchdogTriggered = true;
        break;
      }

      iterations++;
      const result = this.packSinglePass(orderedList, typicalMinDim);

      let permScore = Number(result.totalVolume);
      if (this.options.strategy === 'CONSIGNEE_GROUPED') {
        const placementsWithBoxes: PlacedPackageWithBox[] = result.placements.map((p) => ({
          item: p.item,
          box: p.box,
          rotation: p.rotation,
        }));
        const evalRes = evaluateAccessibility(placementsWithBoxes);
        permScore = Number(result.totalVolume) * (0.3 + 0.7 * (evalRes / 100));
      } else if (this.options.strategy === 'LIFO_PRIORITY') {
        const placementsWithBoxes: PlacedPackageWithBox[] = result.placements.map((p) => ({
          item: p.item,
          box: p.box,
          rotation: p.rotation,
        }));
        const evalRes = evaluateLifo(placementsWithBoxes);
        permScore = Number(result.totalVolume) * (0.3 + 0.7 * (evalRes / 100));
      }

      if (
        permScore > bestScore ||
        (permScore === bestScore && result.placements.length > bestPlacements.length)
      ) {
        bestScore = permScore;
        bestVolume = result.totalVolume;
        bestWeight = result.totalWeight;
        bestPlacements = result.placements;
        bestUnplacedReasons = result.unplacedReasons;
        bestRejectionStats = {
          ...result.rejectionStats,
          dimensionsExceeded: initiallyUnplaced.filter((u) => u.reason === 'EXCEED_DIMENSIONS').length,
        };
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
        .map((p) => ({
          packageId: p.id,
          reason: bestUnplacedReasons.get(p.id) ?? ('NO_VALID_PLACEMENT' as const),
        })),
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

    const finalResult: PackingResult = {
      strategy: this.options.strategy,
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
      watchdogTriggered,
      repairStats: {
        attempted: repairRes.repairStepsExecuted,
        applied: repairRes.repairApplied,
        type: repairRes.repairType,
      },
      rejectionStats: bestRejectionStats,
    };

    finalResult.evaluation = evaluateStrategyCriteria(
      this.container,
      packages,
      finalResult,
      this.options.strategy,
    );

    return finalResult;
  }

  /**
   * Executes a single constructive packing pass using Extreme Points.
   */
  private packSinglePass(
    items: PackageItem[],
    typicalMinDim: number,
  ): {
    placements: PlacedItemState[];
    totalVolume: bigint;
    totalWeight: number;
    unplacedReasons: Map<string, UnplacedPackage['reason']>;
    rejectionStats: {
      boundaryExceeded: number;
      collision: number;
      insufficientSupport: number;
      maxStackWeight: number;
      payloadExceeded: number;
    };
  } {
    const epManager = new ExtremePointsManager();
    const voxelGrid = new VoxelGrid3D();
    const stackDag = new StackWeightDAG();

    const placements: PlacedItemState[] = [];
    let totalVolume = 0n;
    let totalWeight = 0;

    const unplacedReasons = new Map<string, UnplacedPackage['reason']>();
    const rejectionStats = {
      boundaryExceeded: 0,
      collision: 0,
      insufficientSupport: 0,
      maxStackWeight: 0,
      payloadExceeded: 0,
    };

    const maxDrop = Math.max(...items.map((i) => i.dropOrder ?? 1), 1);

    for (const item of items) {
      if (totalWeight + item.weightGram > this.container.maxPayloadGram) {
        unplacedReasons.set(item.id, 'EXCEED_PAYLOAD');
        rejectionStats.payloadExceeded++;
        continue;
      }

      const candidateScores: CandidateScore[] = [];
      const rotations = getValidRotations(item);
      const points = epManager.getPoints();

      let bFail = 0;
      let cFail = 0;
      let sFail = 0;
      let dFail = 0;

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
          if (!isInsideContainer(candidateBox, this.container)) {
            bFail++;
            rejectionStats.boundaryExceeded++;
            continue;
          }

          // 2. Collision check
          if (voxelGrid.hasCollision(candidateBox)) {
            cFail++;
            rejectionStats.collision++;
            continue;
          }

          // 3. Bottom support check (>= 80%, contact tolerance 5mm)
          const supportEval = evaluateBottomSupport(
            candidateBox,
            voxelGrid.getAllBoxes(),
            this.options.contactToleranceMm,
            this.options.minSupportRatioBps,
          );
          if (!supportEval.isSupported) {
            sFail++;
            rejectionStats.insufficientSupport++;
            continue;
          }

          // 4. Stacking weight limit check & noStack constraint
          const dagCheck = stackDag.canPlacePackage(
            item,
            candidateBox,
            this.options.contactToleranceMm,
          );
          if (!dagCheck.allowed) {
            dFail++;
            rejectionStats.maxStackWeight++;
            continue;
          }

          // 5. Compute placement evaluation score
          const score = this.calculatePlacementScore(
            candidateBox,
            item,
            maxDrop,
            supportEval.supportRatioBps,
            placements,
            typicalMinDim,
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
      } else {
        if (sFail > 0 && bFail === 0 && cFail === 0) {
          unplacedReasons.set(item.id, 'NO_SUPPORT');
        } else if (dFail > 0 && bFail === 0 && cFail === 0) {
          unplacedReasons.set(item.id, 'MAX_STACK_WEIGHT_EXCEEDED');
        } else {
          unplacedReasons.set(item.id, 'NO_VALID_PLACEMENT');
        }
      }
    }

    return {
      placements,
      totalVolume,
      totalWeight,
      unplacedReasons,
      rejectionStats,
    };
  }

  /**
   * Placement evaluation scoring function.
   * Balances compactness, soft CoG attraction to center, LIFO ordering, vertical tier headroom,
   * flat-deck formation, and width utilization.
   */
  private calculatePlacementScore(
    box: Box3D,
    item: PackageItem,
    maxDrop: number,
    supportRatioBps: number,
    currentPlacements: readonly PlacedItemState[],
    typicalMinDim: number,
  ): number {
    const L = this.container.innerLengthMm;
    const W = this.container.innerWidthMm;
    const H = this.container.innerHeightMm;

    // 1. Compactness: Prioritize lowest Z, then deepest X (from back wall to doors), then tightest Y
    const fCompact = - (3000 * (box.z / H) + 2000 * (box.x / L) + 1000 * (box.y / W));

    // 2. Soft CoG Pull: evaluate where CoG would move
    const testPlacements = [...currentPlacements, { item, box, rotation: 0 }];
    const cog = calculateCenterOfGravity(testPlacements, this.container);
    const diff = Math.abs(cog.xPercentage - 50.0);
    // Steep penalty if CoG strays outside safety corridor [45%, 55%]
    const fCog = diff > 5.0 ? - (diff * diff * 40) : - (diff * 20);

    // 3. LIFO bonus: only active for LIFO_PRIORITY strategy
    let fLifo = 0;
    if (this.options.strategy === 'LIFO_PRIORITY') {
      const drop = item.dropOrder ?? 1;
      const dropPriority = (maxDrop - drop + 1) / maxDrop;
      fLifo = ((box.x + box.w) / L) * dropPriority * 500;
    }

    // 4. Support bonus: higher contact ratio is preferred
    const fSupport = (supportRatioBps / 10000) * 800;

    // 5. Headroom & Vertical Tier Stacking Heuristics:
    const topZ = box.z + box.h;
    const remainingHeadroom = H - topZ;
    let fHeadroom = 0;

    // Headroom penalty only applies when there is potential for at least 2 packages above box.z
    // (i.e. this is NOT the top tier), but this placement consumes so much height that
    // remaining headroom is smaller than a standard package, killing the tier above it.
    if (box.z + 2 * typicalMinDim <= H) {
      if (remainingHeadroom > 0 && remainingHeadroom < typicalMinDim) {
        fHeadroom = -15000;
      }
      // Mid-tier coordination: on intermediate tiers, penalize pushing topZ beyond the boundary
      // needed for the final tier (H - typicalMinDim)
      if (box.z >= typicalMinDim * 0.7 && topZ > H - typicalMinDim) {
        fHeadroom -= 20000;
      }
    }

    // 6. Coplanar Deck Alignment Bonus:
    // Forming continuous flat decks gives upper packages strong bottom support
    let fCoplanar = 0;
    if (topZ < H) {
      for (const p of currentPlacements) {
        if (Math.abs((p.box.z + p.box.h) - topZ) <= this.options.contactToleranceMm) {
          fCoplanar = 2500;
          break;
        }
      }
    }

    // 7. Tier-specialization:
    // Large items (min dimension >= 0.33 * H) should be placed on lower tiers (z < H * 0.65)
    // Packages with height <= typicalMinDim fit easily on the top tier
    const pkgMinDim = Math.min(item.lengthMm, item.widthMm, item.heightMm);
    let fTierSpecialization = 0;
    if (box.z + 2 * typicalMinDim <= H) {
      if (pkgMinDim >= 0.33 * H) {
        fTierSpecialization = 4000;
      }
    } else {
      if (box.h <= typicalMinDim) {
        fTierSpecialization = 5000;
      }
    }

    // 8. noStack Handling:
    // Penalize placing noStack packages on lower tiers where they block vertical space.
    // Reward placing them near the top where nothing needs to be stacked on them.
    let fNoStack = 0;
    if (item.noStack) {
      if (box.z + 2 * typicalMinDim <= H) {
        fNoStack = -12000;
      } else {
        fNoStack = 8000;
      }
    }

    // 9. Width Utilization along Y:
    let fWidth = 0;
    const yExtent = box.y + box.l;
    if (box.y === 0) {
      if (box.l >= W * 0.42 && box.l <= W * 0.52) fWidth = 1500;
    } else {
      const unusedY = W - yExtent;
      if (unusedY >= 0 && unusedY < 250) fWidth = 2000;
    }

    // 10. Low profile bonus on lower tiers:
    let fProfile = 0;
    if (box.z + 2 * typicalMinDim <= H) {
      if (box.h <= typicalMinDim) fProfile = 2500;
    } else {
      fProfile = (box.h / H) * 1000;
    }

    let score =
      fCompact +
      fCog +
      fLifo +
      fSupport +
      fHeadroom +
      fCoplanar +
      fTierSpecialization +
      fNoStack +
      fWidth +
      fProfile;

    if (this.options.strategy === 'CONSIGNEE_GROUPED') {
      let fCluster = 0;
      for (const placed of currentPlacements) {
        const dx = Math.max(0, Math.max(box.x, placed.box.x) - Math.min(box.x + box.w, placed.box.x + placed.box.w));
        const dy = Math.max(0, Math.max(box.y, placed.box.y) - Math.min(box.y + box.l, placed.box.y + placed.box.l));
        const dz = Math.max(0, Math.max(box.z, placed.box.z) - Math.min(box.z + box.h, placed.box.z + placed.box.h));

        if (dx <= 20 && dy <= 20 && dz <= 20) {
          if (placed.item.companyId && item.companyId && placed.item.companyId === item.companyId) {
            fCluster += 10000;
          } else {
            fCluster -= 5000;
          }
        }
      }
      score += fCluster;
    } else if (this.options.strategy === 'LIFO_PRIORITY') {
      const drop = item.dropOrder ?? 1;
      const targetXFrac = 1.0 - (drop - 1) / Math.max(1, maxDrop - 1);
      const actualXFrac = (box.x + box.w / 2) / L;
      const xDist = Math.abs(actualXFrac - targetXFrac);
      score += - xDist * 10000;
    }

    return score;
  }

  /**
   * Generates deterministic permutations and sortings of package items.
   */
  private generateOrderings(items: PackageItem[], _typicalMinDim: number): PackageItem[][] {
    const orderings: PackageItem[][] = [];

    if (this.options.strategy === 'CONSIGNEE_GROUPED') {
      const companies = Array.from(new Set(items.map((i) => i.companyId ?? 'DEFAULT')));
      const compVolumes = new Map<string, number>();
      for (const c of companies) {
        const v = items
          .filter((i) => (i.companyId ?? 'DEFAULT') === c)
          .reduce((sum, i) => sum + i.lengthMm * i.widthMm * i.heightMm, 0);
        compVolumes.set(c, v);
      }

      const companyPermutations = [
        [...companies].sort((a, b) => (compVolumes.get(b) ?? 0) - (compVolumes.get(a) ?? 0)),
        [...companies].sort((a, b) => a.localeCompare(b)),
        [...companies].reverse(),
      ];

      for (const cOrder of companyPermutations) {
        const perm: PackageItem[] = [];
        for (const c of cOrder) {
          const cItems = items
            .filter((i) => (i.companyId ?? 'DEFAULT') === c)
            .sort((a, b) => {
              if (a.noStack !== b.noStack) return a.noStack ? 1 : -1;
              const va = BigInt(a.lengthMm) * BigInt(a.widthMm) * BigInt(a.heightMm);
              const vb = BigInt(b.lengthMm) * BigInt(b.widthMm) * BigInt(b.heightMm);
              if (vb > va) return 1;
              if (vb < va) return -1;
              return b.weightGram - a.weightGram;
            });
          perm.push(...cItems);
        }
        orderings.push(perm);
      }
    } else if (this.options.strategy === 'LIFO_PRIORITY') {
      // Group strictly by dropOrder DESCENDING (late drops packed first at X=0, early drops at doors X=L)
      const dropOrders = Array.from(new Set(items.map((i) => i.dropOrder ?? 1))).sort((a, b) => b - a);

      // Ordering 1: DropOrder descending, stackable first, then volume descending
      const perm1: PackageItem[] = [];
      for (const d of dropOrders) {
        const dItems = items
          .filter((i) => (i.dropOrder ?? 1) === d)
          .sort((a, b) => {
            if (a.noStack !== b.noStack) return a.noStack ? 1 : -1;
            const va = BigInt(a.lengthMm) * BigInt(a.widthMm) * BigInt(a.heightMm);
            const vb = BigInt(b.lengthMm) * BigInt(b.widthMm) * BigInt(b.heightMm);
            if (vb > va) return 1;
            if (vb < va) return -1;
            return b.weightGram - a.weightGram;
          });
        perm1.push(...dItems);
      }
      orderings.push(perm1);

      // Ordering 2: DropOrder descending, weight descending
      const perm2: PackageItem[] = [];
      for (const d of dropOrders) {
        const dItems = items
          .filter((i) => (i.dropOrder ?? 1) === d)
          .sort((a, b) => b.weightGram - a.weightGram);
        perm2.push(...dItems);
      }
      orderings.push(perm2);

      // Ordering 3: DropOrder descending, base area descending
      const perm3: PackageItem[] = [];
      for (const d of dropOrders) {
        const dItems = items
          .filter((i) => (i.dropOrder ?? 1) === d)
          .sort((a, b) => {
            const baseA = Math.max(a.lengthMm * a.widthMm, a.lengthMm * a.heightMm, a.widthMm * a.heightMm);
            const baseB = Math.max(b.lengthMm * b.widthMm, b.lengthMm * b.heightMm, b.widthMm * b.heightMm);
            return baseB - baseA;
          });
        perm3.push(...dItems);
      }
      orderings.push(perm3);
    } else {
      // Heuristic 1: Stackable first, then Volume descending (Standard Best Fit Decreasing)
      orderings.push(
        [...items].sort((a, b) => {
          if (a.noStack !== b.noStack) return a.noStack ? 1 : -1;
          const va = BigInt(a.lengthMm) * BigInt(a.widthMm) * BigInt(a.heightMm);
          const vb = BigInt(b.lengthMm) * BigInt(b.widthMm) * BigInt(b.heightMm);
          if (vb > va) return 1;
          if (vb < va) return -1;
          return b.weightGram - a.weightGram;
        }),
      );

      // Heuristic 2: Height-inflexible first (large min dimension), then Volume descending
      orderings.push(
        [...items].sort((a, b) => {
          if (a.noStack !== b.noStack) return a.noStack ? 1 : -1;
          const minA = Math.min(a.lengthMm, a.widthMm, a.heightMm);
          const minB = Math.min(b.lengthMm, b.widthMm, b.heightMm);
          const infA = minA >= 0.33 * this.container.innerHeightMm ? 1 : 0;
          const infB = minB >= 0.33 * this.container.innerHeightMm ? 1 : 0;
          if (infA !== infB) return infB - infA;
          const va = BigInt(a.lengthMm) * BigInt(a.widthMm) * BigInt(a.heightMm);
          const vb = BigInt(b.lengthMm) * BigInt(b.widthMm) * BigInt(b.heightMm);
          if (vb > va) return 1;
          if (vb < va) return -1;
          return b.weightGram - a.weightGram;
        }),
      );

      // Heuristic 3: Density descending (mass / volume)
      orderings.push(
        [...items].sort((a, b) => {
          if (a.noStack !== b.noStack) return a.noStack ? 1 : -1;
          const densA = a.weightGram / (a.lengthMm * a.widthMm * a.heightMm);
          const densB = b.weightGram / (b.lengthMm * b.widthMm * b.heightMm);
          return densB - densA;
        }),
      );

      // Heuristic 4: Shipment Lot Batching (if multiple company IDs exist)
      const companies = Array.from(new Set(items.map((i) => i.companyId ?? 'DEFAULT')));
      if (companies.length > 1) {
        const compVolumes = new Map<string, number>();
        for (const c of companies) {
          const v = items
            .filter((i) => (i.companyId ?? 'DEFAULT') === c)
            .reduce((sum, i) => sum + i.lengthMm * i.widthMm * i.heightMm, 0);
          compVolumes.set(c, v);
        }
        const compsByVolDesc = [...companies].sort((a, b) => (compVolumes.get(b) ?? 0) - (compVolumes.get(a) ?? 0));
        const lotBatchAsc: PackageItem[] = [];
        for (const c of [...compsByVolDesc].reverse()) {
          const cItems = items
            .filter((i) => (i.companyId ?? 'DEFAULT') === c)
            .sort((a, b) => {
              if (a.noStack !== b.noStack) return a.noStack ? 1 : -1;
              const va = BigInt(a.lengthMm) * BigInt(a.widthMm) * BigInt(a.heightMm);
              const vb = BigInt(b.lengthMm) * BigInt(b.widthMm) * BigInt(b.heightMm);
              if (vb > va) return 1;
              if (vb < va) return -1;
              return b.weightGram - a.weightGram;
            });
          lotBatchAsc.push(...cItems);
        }
        orderings.push(lotBatchAsc);

        // Perturbations of lot batching with windowed shuffle
        const baseList = [...lotBatchAsc];
        for (let i = 0; i < 2; i++) {
          const copy = [...baseList];
          const windowSize = Math.min(5, copy.length);
          for (let j = 0; j < copy.length - windowSize; j += windowSize) {
            const slice = copy.slice(j, j + windowSize);
            this.rng.shuffle(slice);
            copy.splice(j, windowSize, ...slice);
          }
          orderings.push(copy);
        }
      }

      // Heuristic 5: Max base area descending (w * l)
      orderings.push(
        [...items].sort((a, b) => {
          const baseA = Math.max(a.lengthMm * a.widthMm, a.lengthMm * a.heightMm, a.widthMm * a.heightMm);
          const baseB = Math.max(b.lengthMm * b.widthMm, b.lengthMm * b.heightMm, b.widthMm * b.heightMm);
          return baseB - baseA;
        }),
      );
    }

    // Further permutations via deterministic seeded shuffle up to maxEvaluations if needed
    const baseList = [...orderings[0]];
    const extraNeeded = Math.max(0, this.options.maxEvaluations - orderings.length);
    for (let i = 0; i < extraNeeded; i++) {
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

    return orderings.slice(0, this.options.maxEvaluations);
  }
}

/**
 * Top-level pure function to pack packages into a container using a single strategy.
 */
export function packContainers(
  container: ContainerDimension,
  packages: PackageItem[],
  options?: PackingOptions,
): PackingResult {
  const packer = new ExtremePointPacker(container, options);
  return packer.pack(packages);
}

/**
 * Top-level pure function to pack packages across all 3 strategies concurrently.
 */
export function packMultiStrategies(
  container: ContainerDimension,
  packages: PackageItem[],
  options?: Omit<PackingOptions, 'strategy'>,
): MultiStrategyPackingResult {
  const startTime = Date.now();
  const strategies: PackingStrategy[] = [
    'CONSIGNEE_GROUPED',
    'MAX_VOLUME',
    'LIFO_PRIORITY',
  ];

  const results: Record<PackingStrategy, PackingResult> = {} as any;
  for (const strat of strategies) {
    const packer = new ExtremePointPacker(container, {
      ...options,
      strategy: strat,
    });
    results[strat] = packer.pack(packages);
  }

  let bestStrat: PackingStrategy = 'CONSIGNEE_GROUPED';
  let highestFill = -1;
  for (const strat of strategies) {
    const rate = results[strat].fillRateBps;
    if (rate > highestFill) {
      highestFill = rate;
      bestStrat = strat;
    }
  }

  return {
    strategies: results,
    recommendedStrategy: bestStrat,
    executionTimeMs: Date.now() - startTime,
  };
}
