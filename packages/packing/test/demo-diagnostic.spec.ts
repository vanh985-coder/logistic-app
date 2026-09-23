import { describe, it, expect } from 'vitest';
import {
  ContainerDimension,
  PackageItem,
  ExtremePointPacker,
  ExtremePointsManager,
  Box3D,
  evaluateBottomSupport,
  VoxelGrid3D,
  StackWeightDAG,
  getValidRotations,
  getOrientedDimensions,
  isInsideContainer,
  calculateCenterOfGravity,
  packContainers,
} from '../src/index';

const CONTAINER_40HC: ContainerDimension = {
  innerLengthMm: 12032,
  innerWidthMm: 2352,
  innerHeightMm: 2698,
  maxPayloadGram: 26500000,
};

function getDemoPackages(): PackageItem[] {
  const shipments = [
    // Shipper 1: Hòa Phát
    {
      dropOrder: 1,
      code: 'SHP-DEMO-HP01',
      pkgs: [
        { l: 1200, w: 1000, h: 1000, wt: 220000, f: false, ns: false },
        { l: 1200, w: 1000, h: 1000, wt: 220000, f: false, ns: false },
        { l: 1100, w: 900, h: 1000, wt: 180000, f: false, ns: false },
        { l: 1100, w: 900, h: 1000, wt: 180000, f: false, ns: false },
        { l: 1000, w: 800, h: 1000, wt: 150000, f: false, ns: false },
        { l: 1000, w: 800, h: 1000, wt: 150000, f: false, ns: false },
        { l: 1200, w: 800, h: 1100, wt: 200000, f: false, ns: false },
        { l: 1200, w: 800, h: 1100, wt: 200000, f: true, ns: false },
      ],
    },
    {
      dropOrder: 2,
      code: 'SHP-DEMO-HP02',
      pkgs: [
        { l: 1000, w: 800, h: 900, wt: 130000, f: false, ns: false },
        { l: 1000, w: 800, h: 900, wt: 130000, f: false, ns: false },
        { l: 900, w: 900, h: 900, wt: 135000, f: false, ns: false },
        { l: 900, w: 900, h: 900, wt: 135000, f: false, ns: false },
        { l: 1100, w: 800, h: 800, wt: 130000, f: false, ns: false },
        { l: 1100, w: 800, h: 800, wt: 130000, f: false, ns: false },
        { l: 1000, w: 1000, h: 800, wt: 150000, f: false, ns: false },
        { l: 1000, w: 1000, h: 800, wt: 150000, f: false, ns: false },
        { l: 1200, w: 900, h: 800, wt: 160000, f: false, ns: true },
        { l: 1200, w: 900, h: 800, wt: 160000, f: false, ns: false },
      ],
    },
    // Shipper 2: Tân Cường
    {
      dropOrder: 3,
      code: 'SHP-DEMO-TC01',
      pkgs: [
        { l: 1200, w: 1100, h: 1000, wt: 250000, f: true, ns: false },
        { l: 1200, w: 1100, h: 1000, wt: 250000, f: true, ns: false },
        { l: 1100, w: 1000, h: 1000, wt: 210000, f: false, ns: false },
        { l: 1100, w: 1000, h: 1000, wt: 210000, f: false, ns: false },
        { l: 1200, w: 900, h: 1100, wt: 230000, f: true, ns: false },
        { l: 1200, w: 900, h: 1100, wt: 230000, f: false, ns: false },
        { l: 1200, w: 1000, h: 1000, wt: 230000, f: false, ns: false },
      ],
    },
    {
      dropOrder: 4,
      code: 'SHP-DEMO-TC02',
      pkgs: [
        { l: 1000, w: 900, h: 900, wt: 150000, f: false, ns: false },
        { l: 1000, w: 900, h: 900, wt: 150000, f: false, ns: false },
        { l: 1100, w: 800, h: 900, wt: 145000, f: false, ns: false },
        { l: 1100, w: 800, h: 900, wt: 145000, f: true, ns: false },
        { l: 1000, w: 800, h: 1000, wt: 150000, f: false, ns: false },
        { l: 1000, w: 800, h: 1000, wt: 150000, f: false, ns: false },
        { l: 1200, w: 800, h: 900, wt: 160000, f: false, ns: false },
        { l: 1200, w: 800, h: 900, wt: 160000, f: false, ns: false },
        { l: 1000, w: 900, h: 1000, wt: 170000, f: false, ns: false },
      ],
    },
    // Shipper 3: Cát Tường
    {
      dropOrder: 5,
      code: 'SHP-DEMO-CT01',
      pkgs: [
        { l: 1100, w: 800, h: 800, wt: 130000, f: false, ns: true },
        { l: 1100, w: 800, h: 800, wt: 130000, f: false, ns: true },
        { l: 1000, w: 900, h: 800, wt: 135000, f: false, ns: false },
        { l: 1000, w: 900, h: 800, wt: 135000, f: false, ns: false },
        { l: 1200, w: 800, h: 700, wt: 125000, f: false, ns: false },
        { l: 1200, w: 800, h: 700, wt: 125000, f: false, ns: false },
        { l: 900, w: 900, h: 900, wt: 135000, f: false, ns: false },
        { l: 900, w: 900, h: 900, wt: 135000, f: false, ns: false },
        { l: 1100, w: 900, h: 800, wt: 145000, f: false, ns: false },
        { l: 1100, w: 900, h: 800, wt: 145000, f: false, ns: false },
        { l: 1000, w: 1000, h: 800, wt: 150000, f: false, ns: true },
        { l: 1000, w: 1000, h: 800, wt: 150000, f: false, ns: false },
      ],
    },
    {
      dropOrder: 6,
      code: 'SHP-DEMO-CT02',
      pkgs: [
        { l: 1200, w: 1100, h: 900, wt: 220000, f: false, ns: false },
        { l: 1200, w: 1100, h: 900, wt: 220000, f: false, ns: true },
        { l: 1200, w: 1000, h: 1000, wt: 220000, f: false, ns: false },
        { l: 1200, w: 1000, h: 1000, wt: 220000, f: false, ns: false },
        { l: 1100, w: 1100, h: 1000, wt: 225000, f: false, ns: false },
        { l: 1100, w: 1100, h: 1000, wt: 225000, f: false, ns: false },
      ],
    },
    // Shipper 4: Dũng Tiến
    {
      dropOrder: 7,
      code: 'SHP-DEMO-DT01',
      pkgs: [
        { l: 1000, w: 800, h: 900, wt: 150000, f: false, ns: false },
        { l: 1000, w: 800, h: 900, wt: 150000, f: false, ns: false },
        { l: 1100, w: 800, h: 900, wt: 160000, f: false, ns: false },
        { l: 1100, w: 800, h: 900, wt: 160000, f: false, ns: false },
        { l: 1000, w: 900, h: 900, wt: 170000, f: false, ns: false },
        { l: 1000, w: 900, h: 900, wt: 170000, f: false, ns: false },
        { l: 1200, w: 800, h: 800, wt: 160000, f: false, ns: false },
        { l: 1200, w: 800, h: 800, wt: 160000, f: false, ns: false },
        { l: 900, w: 900, h: 900, wt: 150000, f: false, ns: false },
        { l: 1100, w: 900, h: 800, wt: 165000, f: false, ns: false },
        { l: 1100, w: 900, h: 800, wt: 165000, f: false, ns: false },
      ],
    },
    {
      dropOrder: 8,
      code: 'SHP-DEMO-DT02',
      pkgs: [
        { l: 1200, w: 1000, h: 900, wt: 210000, f: false, ns: false },
        { l: 1200, w: 1000, h: 900, wt: 210000, f: true, ns: false },
        { l: 1100, w: 1000, h: 900, wt: 195000, f: false, ns: false },
        { l: 1100, w: 1000, h: 900, wt: 195000, f: false, ns: false },
        { l: 1000, w: 1000, h: 900, wt: 180000, f: false, ns: false },
        { l: 1000, w: 1000, h: 900, wt: 180000, f: false, ns: true },
        { l: 1100, w: 900, h: 900, wt: 175000, f: false, ns: false },
        { l: 1100, w: 900, h: 900, wt: 175000, f: false, ns: false },
      ],
    },
  ];

  const packages: PackageItem[] = [];
  for (const s of shipments) {
    for (let i = 0; i < s.pkgs.length; i++) {
      const p = s.pkgs[i];
      packages.push({
        id: `${s.code}-P${String(i + 1).padStart(2, '0')}`,
        sku: `${s.code}-P${String(i + 1).padStart(2, '0')}`,
        lengthMm: p.l,
        widthMm: p.w,
        heightMm: p.h,
        weightGram: p.wt,
        fragile: p.f,
        noStack: p.ns,
        rotatable: true,
        dropOrder: s.dropOrder,
      });
    }
  }
  return packages;
}

describe('Investigation of Stacking Defect (5 Steps)', () => {
  it('Step 1: Baseline Packing & Detailed Rejection Breakdown', () => {
    const packages = getDemoPackages();
    console.log(`\n=== STEP 1: RUNNING CURRENT PACKER ON 71 DEMO PACKAGES ===`);
    const packer = new ExtremePointPacker(CONTAINER_40HC);
    const result = packer.pack(packages);

    console.log(`Placed packages: ${result.placedPackages.length} / ${packages.length}`);
    console.log(`Fill rate: ${(result.fillRateBps / 100).toFixed(2)}%`);
    console.log(`CoG: X=${result.centerOfGravity.xPercentage}%, Y=${result.centerOfGravity.yPercentage}%, Z=${result.centerOfGravity.zPercentage}% (${result.centerOfGravity.zMm} mm / ${CONTAINER_40HC.innerHeightMm} mm)`);
    console.log(`Unplaced count: ${result.unplacedPackages.length}`);
    console.log(`Rejection stats:`, JSON.stringify(result.rejectionStats, null, 2));

    const zCounts: Record<number, number> = {};
    for (const p of result.placedPackages) {
      zCounts[p.zMm] = (zCounts[p.zMm] || 0) + 1;
    }
    console.log(`Placed packages Z distribution:`, zCounts);

    // Now let's trace a single pass in detail:
    console.log(`\n--- TRACING UNPLACED PACKAGES IN DETAIL ---`);
    const placedSet = new Set(result.placedPackages.map((p) => p.packageId));
    const unplaced = packages.filter((p) => !placedSet.has(p.id));
    console.log(`Unplaced package count: ${unplaced.length}`);

    // Let's run a custom pass where we intercept each unplaced package
    // to see every EP and why it failed!
    const epManager = new ExtremePointsManager();
    const voxelGrid = new VoxelGrid3D();
    const stackDag = new StackWeightDAG();
    const sorted = [...packages].sort((a, b) => {
      const va = BigInt(a.lengthMm) * BigInt(a.widthMm) * BigInt(a.heightMm);
      const vb = BigInt(b.lengthMm) * BigInt(b.widthMm) * BigInt(b.heightMm);
      if (vb > va) return 1;
      if (vb < va) return -1;
      return b.weightGram - a.weightGram;
    });

    const unplacedSummary: Array<{
      id: string;
      dims: string;
      totalEPs: number;
      boundaryFails: number;
      collisionFails: number;
      supportFails: number;
      dagFails: number;
      supportRatios: number[];
      samplePoints: string[];
    }> = [];

    for (const item of sorted) {
      const rotations = getValidRotations(item);
      const points = epManager.getPoints();

      let bFail = 0;
      let cFail = 0;
      let sFail = 0;
      let dFail = 0;
      const sRatios: number[] = [];
      let placed = false;
      let bestCandidate: any = null;

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

          if (!isInsideContainer(candidateBox, CONTAINER_40HC)) {
            bFail++;
            continue;
          }
          if (voxelGrid.hasCollision(candidateBox)) {
            cFail++;
            continue;
          }
          const supportEval = evaluateBottomSupport(candidateBox, voxelGrid.getAllBoxes(), 5, 8000);
          if (!supportEval.isSupported) {
            sFail++;
            sRatios.push(supportEval.supportRatioBps);
            continue;
          }
          const dagCheck = stackDag.canPlacePackage(item, candidateBox, 5);
          if (!dagCheck.allowed) {
            dFail++;
            continue;
          }

          bestCandidate = { box: candidateBox, rotation: rot };
          placed = true;
          break;
        }
        if (placed) break;
      }

      if (placed && bestCandidate) {
        voxelGrid.insert(bestCandidate.box);
        epManager.update(bestCandidate.box, voxelGrid.getAllBoxes(), CONTAINER_40HC, 5);
        stackDag.addPlacement(item, bestCandidate.box, 5);
      } else {
        unplacedSummary.push({
          id: item.id,
          dims: `${item.lengthMm}x${item.widthMm}x${item.heightMm}`,
          totalEPs: points.length,
          boundaryFails: bFail,
          collisionFails: cFail,
          supportFails: sFail,
          dagFails: dFail,
          supportRatios: sRatios.slice(0, 5),
          samplePoints: points.slice(0, 5).map((pt) => `(${pt.x},${pt.y},${pt.z})`),
        });
      }
    }

    console.log(`\nUNPLACED PACKAGES BREAKDOWN TABLE:`);
    console.table(
      unplacedSummary.map((u) => ({
        id: u.id,
        dims: u.dims,
        EPs: u.totalEPs,
        boundary: u.boundaryFails,
        collision: u.collisionFails,
        noSupport: u.supportFails,
        maxStack: u.dagFails,
        sampleRatios: u.supportRatios.map((r) => `${(r/100).toFixed(0)}%`).join(','),
      }))
    );

    console.log(`\n--- ALL PLACED BOXES (${voxelGrid.getAllBoxes().length}) ---`);
    for (const b of voxelGrid.getAllBoxes()) {
      console.log(`Box at [x=${b.x}..${b.x+b.w}, y=${b.y}..${b.y+b.l}, z=${b.z}..${b.z+b.h}] (w=${b.w}, l=${b.l}, h=${b.h})`);
    }

    console.log(`\n--- DEEP DIVE: WHY DID SHP-DEMO-CT01-P11 FAIL AT ALL 173 EPs? ---`);
    const testPkg = sorted.find((p) => p.id === 'SHP-DEMO-CT01-P11')!;
    const rotations = getValidRotations(testPkg);
    const points = epManager.getPoints();

    let countXExceed = 0;
    let countYExceed = 0;
    let countZExceed = 0;
    let countCollision = 0;
    let countNoSupport = 0;
    let countMaxStack = 0;

    for (const p of points) {
      for (const rot of rotations) {
        const dims = getOrientedDimensions(testPkg, rot);
        const box: Box3D = { x: p.x, y: p.y, z: p.z, w: dims.w, l: dims.l, h: dims.h };

        if (box.x + box.w > CONTAINER_40HC.innerLengthMm) {
          countXExceed++;
          continue;
        }
        if (box.y + box.l > CONTAINER_40HC.innerWidthMm) {
          countYExceed++;
          continue;
        }
        if (box.z + box.h > CONTAINER_40HC.innerHeightMm) {
          countZExceed++;
          continue;
        }
        if (voxelGrid.hasCollision(box)) {
          countCollision++;
          continue;
        }
        const sup = evaluateBottomSupport(box, voxelGrid.getAllBoxes(), 5, 8000);
        if (!sup.isSupported) {
          countNoSupport++;
          console.log(`Support fail at EP (${p.x}, ${p.y}, ${p.z}) with dims (${box.w}x${box.l}x${box.h}): ratio = ${(sup.supportRatioBps/100).toFixed(1)}%`);
          continue;
        }
        const dag = stackDag.canPlacePackage(testPkg, box, 5);
        if (!dag.allowed) {
          countMaxStack++;
          console.log(`DAG fail at EP (${p.x}, ${p.y}, ${p.z}): reason = ${dag.reason}`);
          continue;
        }
      }
    }

    console.log(`CT01-P11 failure causes across ${points.length * rotations.length} evaluations:`);
    console.log(`  X exceeded (> 12032): ${countXExceed}`);
    console.log(`  Y exceeded (> 2352):  ${countYExceed}`);
    console.log(`  Z exceeded (> 2698):  ${countZExceed}`);
    console.log(`  Collision:            ${countCollision}`);
    console.log(`  No support (< 80%):   ${countNoSupport}`);
    console.log(`  Max stack weight:     ${countMaxStack}`);
  });

  it('Feasibility Analysis: Can all 71 packages fit in 3 tiers of height <= 900?', () => {
    const packages = getDemoPackages();
    let canOrientUnder900 = 0;
    let canOrientUnder1000 = 0;
    const minDims: number[] = [];

    for (const p of packages) {
      const minD = Math.min(p.lengthMm, p.widthMm, p.heightMm);
      minDims.push(minD);
      if (minD <= 900) canOrientUnder900++;
      if (minD <= 1000) canOrientUnder1000++;
    }

    console.log(`\n=== 3-TIER FEASIBILITY ANALYSIS ===`);
    console.log(`Total packages: ${packages.length}`);
    console.log(`Packages with min dimension <= 900 mm: ${canOrientUnder900} / ${packages.length}`);
    console.log(`Packages with min dimension <= 1000 mm: ${canOrientUnder1000} / ${packages.length}`);
    console.log(`Min dimensions frequency:`, minDims.reduce((acc: any, d) => { acc[d] = (acc[d] || 0) + 1; return acc; }, {}));
  });

  it('Step 2: Check epManager.update() after placing packages', () => {
    console.log(`\n=== STEP 2: CHECKING EXTREME POINTS GENERATION (FIRST 5 PLACEMENTS) ===`);
    const packages = getDemoPackages();
    const epManager = new ExtremePointsManager();
    const voxelGrid = new VoxelGrid3D();
    const container = CONTAINER_40HC;

    for (let i = 0; i < 5; i++) {
      const pkg = packages[i];
      const points = epManager.getPoints();
      const rot = 0;
      const dims = getOrientedDimensions(pkg, rot);
      let chosenPoint = points[0];
      const box: Box3D = {
        x: chosenPoint.x,
        y: chosenPoint.y,
        z: chosenPoint.z,
        w: dims.w,
        l: dims.l,
        h: dims.h,
      };

      voxelGrid.insert(box);
      epManager.update(box, voxelGrid.getAllBoxes(), container);

      const updatedPoints = epManager.getPoints();
      const zAboveZero = updatedPoints.filter((p) => p.z > 0);
      console.log(`After Box #${i + 1} (${box.w}x${box.l}x${box.h} at [${box.x}, ${box.y}, ${box.z}]):`);
      console.log(`  Total EPs: ${updatedPoints.length}, EPs with z > 0: ${zAboveZero.length}`);
      console.log(`  Sample EPs with z > 0:`, zAboveZero.slice(0, 5));
    }
  });

  it('Experiment: Packing with Tier-aware height orientation & Enhanced EPs', () => {
    const packages = getDemoPackages();
    console.log(`\n=== EXPERIMENT: TIER-AWARE ORIENTATION & ENHANCED EPs ===`);

    class EnhancedEPManager {
      private points: Array<{ x: number; y: number; z: number }> = [{ x: 0, y: 0, z: 0 }];

      getPoints() { return this.points; }

      update(newBox: Box3D, allBoxes: readonly Box3D[], container: ContainerDimension, contactToleranceMm = 5) {
        const candidatePoints: Array<{ x: number; y: number; z: number }> = [];

        // 1. Direct faces
        candidatePoints.push({ x: newBox.x + newBox.w, y: newBox.y, z: newBox.z });
        candidatePoints.push({ x: newBox.x, y: newBox.y + newBox.l, z: newBox.z });
        candidatePoints.push({ x: newBox.x, y: newBox.y, z: newBox.z + newBox.h });

        // 2. Additional corners of newBox on floor or top
        candidatePoints.push({ x: newBox.x + newBox.w, y: newBox.y, z: newBox.z + newBox.h });
        candidatePoints.push({ x: newBox.x, y: newBox.y + newBox.l, z: newBox.z + newBox.h });

        // 3. Projections against existing boxes in 3D
        for (const b of allBoxes) {
          // Along X
          if (b.x + b.w <= newBox.x + newBox.w && b.y < newBox.y + newBox.l && b.y + b.l > newBox.y) {
            candidatePoints.push({ x: newBox.x + newBox.w, y: b.y + b.l, z: newBox.z });
            candidatePoints.push({ x: newBox.x + newBox.w, y: b.y + b.l, z: newBox.z + newBox.h });
          }
          // Along Y
          if (b.y + b.l <= newBox.y + newBox.l && b.x < newBox.x + newBox.w && b.x + b.w > newBox.x) {
            candidatePoints.push({ x: b.x + b.w, y: newBox.y + newBox.l, z: newBox.z });
            candidatePoints.push({ x: b.x + b.w, y: newBox.y + newBox.l, z: newBox.z + newBox.h });
          }
          // Along Z
          if (b.z + b.h <= newBox.z + newBox.h && b.x < newBox.x + newBox.w && b.x + b.w > newBox.x) {
            candidatePoints.push({ x: b.x + b.w, y: newBox.y, z: b.z + b.h });
            candidatePoints.push({ x: newBox.x, y: b.y + b.l, z: b.z + b.h });
          }
          // On top of newBox: projections of existing boxes
          if (Math.abs(b.z + b.h - (newBox.z + newBox.h)) <= contactToleranceMm) {
            candidatePoints.push({ x: b.x + b.w, y: newBox.y, z: newBox.z + newBox.h });
            candidatePoints.push({ x: newBox.x, y: b.y + b.l, z: newBox.z + newBox.h });
          }
        }

        const combined = [...this.points, ...candidatePoints];
        const validPoints: Array<{ x: number; y: number; z: number }> = [];
        const seen = new Set<string>();

        for (const p of combined) {
          if (
            p.x < 0 || p.y < 0 || p.z < 0 ||
            p.x >= container.innerLengthMm ||
            p.y >= container.innerWidthMm ||
            p.z >= container.innerHeightMm
          ) continue;

          let isInside = false;
          for (const b of allBoxes) {
            if (
              p.x >= b.x && p.x < b.x + b.w &&
              p.y >= b.y && p.y < b.y + b.l &&
              p.z >= b.z && p.z < b.z + b.h
            ) {
              isInside = true;
              break;
            }
          }
          if (isInside) continue;

          if (p.z > 0) {
            let hasSupport = false;
            for (const b of allBoxes) {
              if (
                Math.abs(b.z + b.h - p.z) <= contactToleranceMm &&
                p.x >= b.x && p.x <= b.x + b.w &&
                p.y >= b.y && p.y <= b.y + b.l
              ) {
                hasSupport = true;
                break;
              }
            }
            if (!hasSupport) continue;
          }

          const key = `${p.x}_${p.y}_${p.z}`;
          if (!seen.has(key)) {
            seen.add(key);
            validPoints.push(p);
          }
        }

        validPoints.sort((a, b) => {
          if (a.z !== b.z) return a.z - b.z;
          if (a.x !== b.x) return a.x - b.x;
          return a.y - b.y;
        });

        this.points = validPoints;
      }
    }

    const epManager = new EnhancedEPManager();
    const voxelGrid = new VoxelGrid3D();
    const stackDag = new StackWeightDAG();

    // Multi-pass evaluation across heuristics:
    const basePermutations: Array<{ name: string; list: PackageItem[] }> = [
      {
        name: 'Stackable first, Vol desc',
        list: [...packages].sort((a, b) => {
          if (a.noStack !== b.noStack) return a.noStack ? 1 : -1;
          const va = BigInt(a.lengthMm) * BigInt(a.widthMm) * BigInt(a.heightMm);
          const vb = BigInt(b.lengthMm) * BigInt(b.widthMm) * BigInt(b.heightMm);
          return vb > va ? 1 : -1;
        }),
      },
      {
        name: 'Height-inflexible first (minDim >= 900), then Vol desc',
        list: [...packages].sort((a, b) => {
          if (a.noStack !== b.noStack) return a.noStack ? 1 : -1;
          const minA = Math.min(a.lengthMm, a.widthMm, a.heightMm);
          const minB = Math.min(b.lengthMm, b.widthMm, b.heightMm);
          const infA = minA >= 900 ? 1 : 0;
          const infB = minB >= 900 ? 1 : 0;
          if (infA !== infB) return infB - infA;
          const va = BigInt(a.lengthMm) * BigInt(a.widthMm) * BigInt(a.heightMm);
          const vb = BigInt(b.lengthMm) * BigInt(b.widthMm) * BigInt(b.heightMm);
          return vb > va ? 1 : -1;
        }),
      },
      {
        name: 'Volume desc, Wt desc',
        list: [...packages].sort((a, b) => {
          const va = BigInt(a.lengthMm) * BigInt(a.widthMm) * BigInt(a.heightMm);
          const vb = BigInt(b.lengthMm) * BigInt(b.widthMm) * BigInt(b.heightMm);
          if (vb !== va) return vb > va ? 1 : -1;
          return b.weightGram - a.weightGram;
        }),
      },
      {
        name: 'Weight desc, Vol desc',
        list: [...packages].sort((a, b) => {
          if (b.weightGram !== a.weightGram) return b.weightGram - a.weightGram;
          const va = a.lengthMm * a.widthMm * a.heightMm;
          const vb = b.lengthMm * b.widthMm * b.heightMm;
          return vb - va;
        }),
      },
    ];

    // Add 8 windowed shuffle variations
    const permutations = [...basePermutations];
    let seedVal = 123456789;
    function rand() {
      seedVal = (seedVal * 1664525 + 1013904223) % 4294967296;
      return seedVal / 4294967296;
    }
    for (let p = 0; p < 8; p++) {
      const copy = [...basePermutations[0].list];
      for (let i = 0; i < copy.length - 4; i += 4) {
        if (rand() > 0.5) {
          const tmp = copy[i];
          copy[i] = copy[i + 1];
          copy[i + 1] = tmp;
        }
      }
      permutations.push({ name: `Perturbation #${p + 1}`, list: copy });
    }

    let overallBest = {
      name: '',
      count: 0,
      fillRateBps: 0,
      placements: [] as Array<{ box: Box3D; pkg: PackageItem; rot: number }>,
    };

    for (const perm of permutations) {
      const epMgr = new EnhancedEPManager();
      const vGrid = new VoxelGrid3D();
      const sDag = new StackWeightDAG();
      const currentPlacements: Array<{ box: Box3D; pkg: PackageItem; rot: number }> = [];

      for (const item of perm.list) {
        const rotations = getValidRotations(item);
        const points = epMgr.getPoints();

        let bestScore = -Infinity;
        let bestCandidate: { box: Box3D; rot: number } | null = null;

        for (const p of points) {
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

            if (!isInsideContainer(candidateBox, CONTAINER_40HC)) continue;
            if (vGrid.hasCollision(candidateBox)) continue;
            const sup = evaluateBottomSupport(candidateBox, vGrid.getAllBoxes(), 5, 8000);
            if (!sup.isSupported) continue;
            const dag = sDag.canPlacePackage(item, candidateBox, 5);
            if (!dag.allowed) continue;

            const topZ = candidateBox.z + candidateBox.h;
            const remainingHeadroom = CONTAINER_40HC.innerHeightMm - topZ;
            const deadHeadroom = (remainingHeadroom > 0 && remainingHeadroom < 800);

            let score = - (3000 * (candidateBox.z / CONTAINER_40HC.innerHeightMm) +
                          2000 * (candidateBox.x / CONTAINER_40HC.innerLengthMm) +
                          1000 * (candidateBox.y / CONTAINER_40HC.innerWidthMm));

            // Heavy penalty if this placement leaves dead headroom that kills tier 3
            if (deadHeadroom) {
              score -= 20000;
            }

            // CRITICAL TIER RULE: On Tier 2 (z between 700 and 1800), topZ must NOT exceed 1850mm!
            if (candidateBox.z >= 700 && candidateBox.z < 1800 && topZ > 1850) {
              score -= 25000;
            }

            // FLAT DECK BONUS: Reward aligning with neighboring top surfaces to create continuous platforms
            if (candidateBox.z < 1800) {
              if (topZ === 1800) score += 4000;
              else if (topZ === 900 || topZ === 1000) score += 2000;
            }

            // TIER-SPECIALIZATION BONUS:
            // Items with min dimension >= 900mm CANNOT fit on Tier 3 (1800 + 900 = 2700 > 2698).
            // They MUST be placed on Tier 1 or Tier 2 (z < 1800).
            // Items with height <= 800mm should be saved for Tier 3 (z >= 1700).
            const pkgMinDim = Math.min(item.lengthMm, item.widthMm, item.heightMm);
            if (candidateBox.z < 1700) {
              if (pkgMinDim >= 900) {
                score += 5000; // Prioritize placing 900/1000mm items on Tiers 1 and 2
              }
            } else {
              // On Tier 3:
              if (candidateBox.h <= 800) {
                score += 6000; // Strongly reward 800mm items on Tier 3
              }
            }

            // noStack policy: strongly penalize putting noStack on floor (z=0) or tier 2 (z < 1700),
            // reward putting noStack on tier 3 (z >= 1700)
            if (item.noStack) {
              if (candidateBox.z < 1700) {
                score -= 12000;
              } else {
                score += 10000;
              }
            }

            if (candidateBox.z < 1800) {
              if (candidateBox.h <= 900) score += 3000;
              if (candidateBox.h <= 800) score += 2000;
            } else {
              score += candidateBox.h * 2;
            }

            const yExtent = candidateBox.y + candidateBox.l;
            if (candidateBox.y === 0) {
              if (candidateBox.l >= 1000 && candidateBox.l <= 1200) score += 1500;
            } else {
              const unusedY = CONTAINER_40HC.innerWidthMm - yExtent;
              if (unusedY >= 0 && unusedY < 300) score += 2000;
            }

            score += (sup.supportRatioBps / 10000) * 800;

            if (score > bestScore) {
              bestScore = score;
              bestCandidate = { box: candidateBox, rot };
            }
          }
        }

        if (bestCandidate) {
          vGrid.insert(bestCandidate.box);
          epMgr.update(bestCandidate.box, vGrid.getAllBoxes(), CONTAINER_40HC, 5);
          sDag.addPlacement(item, bestCandidate.box, 5);
          currentPlacements.push({ box: bestCandidate.box, pkg: item, rot: bestCandidate.rot });
        }
      }

      const totalVol = currentPlacements.reduce((acc, p) => acc + BigInt(p.box.w) * BigInt(p.box.l) * BigInt(p.box.h), 0n);
      const contVol = BigInt(CONTAINER_40HC.innerLengthMm) * BigInt(CONTAINER_40HC.innerWidthMm) * BigInt(CONTAINER_40HC.innerHeightMm);
      const fillRateBps = Number((totalVol * 10000n) / contVol);

      console.log(`Permutation "${perm.name}": Placed ${currentPlacements.length}/71, Fill: ${(fillRateBps/100).toFixed(2)}%`);

      if (fillRateBps > overallBest.fillRateBps) {
        overallBest = {
          name: perm.name,
          count: currentPlacements.length,
          fillRateBps,
          placements: currentPlacements,
        };
      }
    }

    console.log(`\n=== OVERALL BEST RESULT ===`);
    console.log(`Best heuristic: "${overallBest.name}"`);
    console.log(`Placed: ${overallBest.count} / ${packages.length}`);
    console.log(`Fill rate: ${(overallBest.fillRateBps / 100).toFixed(2)}%`);
    const zCounts: Record<number, number> = {};
    for (const p of overallBest.placements) {
      zCounts[p.box.z] = (zCounts[p.box.z] || 0) + 1;
    }
    console.log(`Z distribution:`, zCounts);

    const cog = calculateCenterOfGravity(
      overallBest.placements.map((p) => ({ item: p.pkg, box: p.box, rotation: p.rot })),
      CONTAINER_40HC,
    );
    console.log(`CoG: X=${cog.xPercentage}% (${cog.xMm}mm), Y=${cog.yPercentage}% (${cog.yMm}mm), Z=${cog.zPercentage}% (${cog.zMm}mm)`);

    const placedIds = new Set(overallBest.placements.map((p) => p.pkg.id));
    const stillUnplaced = packages.filter((p) => !placedIds.has(p.id));
    console.log(`Still unplaced (${stillUnplaced.length}):`, stillUnplaced.map((p) => `${p.id} (${p.lengthMm}x${p.widthMm}x${p.heightMm}, wt=${p.weightGram/1000}kg, ns=${p.noStack}, f=${p.fragile})`));

    // Let's trace why HP02-P03 failed in the winning permutation
    const vGrid = new VoxelGrid3D();
    for (const p of overallBest.placements) vGrid.insert(p.box);
    console.log(`\n--- TRACING HP02-P03 in WINNING STATE ---`);
    const testPkg = packages.find((p) => p.id === 'SHP-DEMO-HP02-P03')!;
    const testEpMgr = new EnhancedEPManager();
    for (const p of overallBest.placements) {
      testEpMgr.update(p.box, vGrid.getAllBoxes(), CONTAINER_40HC, 5);
    }
    const availPoints = testEpMgr.getPoints();
    console.log(`Available EPs: ${availPoints.length}`);
    let bCount = 0, cCount = 0, sCount = 0, dCount = 0;
    for (const pt of availPoints) {
      const b: Box3D = { x: pt.x, y: pt.y, z: pt.z, w: 900, l: 900, h: 900 };
      if (!isInsideContainer(b, CONTAINER_40HC)) { bCount++; continue; }
      if (vGrid.hasCollision(b)) { cCount++; continue; }
      const sup = evaluateBottomSupport(b, vGrid.getAllBoxes(), 5, 8000);
      if (!sup.isSupported) {
        sCount++;
        console.log(`Support fail at EP (${pt.x}, ${pt.y}, ${pt.z}): ratio = ${(sup.supportRatioBps/100).toFixed(1)}%`);
        continue;
      }
      const sDag = new StackWeightDAG();
      for (const pl of overallBest.placements) sDag.addPlacement(pl.pkg, pl.box, 5);
      const dag = sDag.canPlacePackage(testPkg, b, 5);
      if (!dag.allowed) { dCount++; continue; }
      console.log(`COULD FIT AT (${pt.x}, ${pt.y}, ${pt.z})!`);
    }
    // Let's test if there is ANY place in the container where 900x900x900 can fit!
    let foundAnywhere = false;
    let foundCoord: any = null;
    // Test along 100mm steps:
    for (let z = 0; z <= CONTAINER_40HC.innerHeightMm - 900; z += 100) {
      for (let y = 0; y <= CONTAINER_40HC.innerWidthMm - 900; y += 50) {
        for (let x = 0; x <= CONTAINER_40HC.innerLengthMm - 900; x += 50) {
          const testBox: Box3D = { x, y, z, w: 900, l: 900, h: 900 };
          if (!vGrid.hasCollision(testBox)) {
            const sup = evaluateBottomSupport(testBox, vGrid.getAllBoxes(), 5, 8000);
            if (sup.isSupported) {
              foundAnywhere = true;
              foundCoord = { x, y, z, supportRatio: sup.supportRatioBps };
              break;
            }
          }
        }
        if (foundAnywhere) break;
      }
      if (foundAnywhere) break;
    }
    if (foundAnywhere) {
      console.log(`>>> YES! 900x900x900 CAN FIT IN CONTAINER at:`, foundCoord);
    } else {
      console.log(`>>> NO! 900x900x900 CANNOT FIT ANYWHERE IN CONTAINER in this 66-package packing!`);
    }
  });

  it('Production packContainers() on 71 Demo Packages', () => {
    const packages = getDemoPackages();
    const result = packContainers(CONTAINER_40HC, packages);

    console.log(`\n=== PRODUCTION packContainers() RESULT ON DEMO DATASET ===`);
    console.log(`Placed: ${result.placedPackages.length} / ${packages.length}`);
    console.log(`Fill rate: ${(result.fillRateBps / 100).toFixed(2)}%`);
    console.log(`CoG X: ${result.centerOfGravity.xPercentage}% (violation: ${result.cogViolation})`);
    console.log(`CoG Y: ${result.centerOfGravity.yPercentage}%`);
    console.log(`CoG Z: ${result.centerOfGravity.zPercentage}% (${result.centerOfGravity.zMm}mm)`);
    console.log(`Unplaced: ${result.unplacedPackages.length}`);
    console.log(`Rejections:`, result.rejectionStats);

    const zCounts: Record<number, number> = {};
    for (const p of result.placedPackages) {
      zCounts[p.zMm] = (zCounts[p.zMm] || 0) + 1;
    }
    console.log(`Z distribution:`, zCounts);

    expect(result.placedPackages.length).toBeGreaterThanOrEqual(65);
    expect(result.fillRateBps).toBeGreaterThanOrEqual(7700);
    expect(result.cogViolation).toBe(false);
  });
});
