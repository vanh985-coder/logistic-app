import { describe, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  ContainerDimension,
  PackageItem,
  PackingResult,
  Box3D,
  isInsideContainer,
  getOrientedDimensions,
  VoxelGrid3D,
  ExtremePointsManager,
  evaluateBottomSupport,
  StackWeightDAG,
  calculateCenterOfGravity,
  PlacedItemState,
  packContainers,
} from '../src/index';

// -------------------------------------------------------------
// Strategy Implementations for Benchmarking
// -------------------------------------------------------------

const CONTAINER_40HC: ContainerDimension = {
  innerLengthMm: 12032,
  innerWidthMm: 2352,
  innerHeightMm: 2698,
  maxPayloadGram: 26500000,
};

interface StrategyResult {
  strategy: 'A_MANUAL' | 'B_EXPERIENCED' | 'C_EXTREME_POINT';
  scenario: string;
  container1FillRatePct: number;
  container1PlacedCount: number;
  totalPackages: number;
  containersNeeded: number;
  container1CogX: number;
  totalTimeMs: number;
}

/**
 * Strategy A: "Xếp thủ công" (Baseline)
 * - Order: Exact original input order.
 * - Rotations: No rotation (rot = 0 only).
 * - Placement: First valid position found scanning from floor up (Z -> X -> Y).
 * - No scoring, no local search, no CoG repair.
 */
function packStrategyA(container: ContainerDimension, packages: PackageItem[]): PackingResult {
  const startTime = performance.now();
  const epManager = new ExtremePointsManager();
  const voxelGrid = new VoxelGrid3D();
  const stackDag = new StackWeightDAG();

  const placements: PlacedItemState[] = [];
  let totalVolume = 0n;
  let totalWeight = 0;

  for (const item of packages) {
    if (totalWeight + item.weightGram > container.maxPayloadGram) continue;

    const points = epManager.getPoints(); // sorted Z -> X -> Y
    let placed = false;

    for (const p of points) {
      const dims = getOrientedDimensions(item, 0); // No rotation
      const box: Box3D = { x: p.x, y: p.y, z: p.z, w: dims.w, l: dims.l, h: dims.h };

      if (!isInsideContainer(box, container)) continue;
      if (voxelGrid.hasCollision(box)) continue;
      const sup = evaluateBottomSupport(box, voxelGrid.getAllBoxes(), 5, 8000);
      if (!sup.isSupported) continue;
      const dag = stackDag.canPlacePackage(item, box, 5);
      if (!dag.allowed) continue;

      // First valid position accepted!
      voxelGrid.insert(box);
      epManager.update(box, voxelGrid.getAllBoxes(), container, 5);
      stackDag.addPlacement(item, box, 5);

      placements.push({ item, box, rotation: 0 });
      totalVolume += BigInt(box.w) * BigInt(box.l) * BigInt(box.h);
      totalWeight += item.weightGram;
      placed = true;
      break;
    }
  }

  const containerVolume = BigInt(container.innerLengthMm) * BigInt(container.innerWidthMm) * BigInt(container.innerHeightMm);
  const fillRateBps = Number((totalVolume * 10000n) / containerVolume);
  const cog = calculateCenterOfGravity(placements, container);
  const cogViolation = cog.xPercentage < 45.0 || cog.xPercentage > 55.0;

  return {
    fillRateBps,
    centerOfGravity: cog,
    placedPackages: placements.map(p => ({
      packageId: p.item.id,
      xMm: p.box.x,
      yMm: p.box.y,
      zMm: p.box.z,
      placedLengthMm: p.box.w,
      placedWidthMm: p.box.l,
      placedHeightMm: p.box.h,
      rotation: p.rotation,
      layerIndex: Math.floor(p.box.z / 500),
    })),
    unplacedPackages: packages.filter(p => !placements.some(pl => pl.item.id === p.id)).map(p => ({ packageId: p.id, reason: 'NO_VALID_PLACEMENT' })),
    executionTimeMs: performance.now() - startTime,
    algorithmVersion: 'strategy-a-manual',
    cogViolation,
    totalWeightGrams: totalWeight,
    totalVolumeMm3: totalVolume.toString(),
    iterationsExecuted: 1,
    watchdogTriggered: false,
  };
}

/**
 * Strategy B: "Xếp có kinh nghiệm"
 * - Order: Sorted volume descending.
 * - Rotations: Vertical axis rotation only (yaw: rot 0: L*W*H, rot 1: W*L*H).
 * - Placement: First valid position found.
 */
function packStrategyB(container: ContainerDimension, packages: PackageItem[]): PackingResult {
  const startTime = performance.now();
  const sorted = [...packages].sort((a, b) => {
    const va = BigInt(a.lengthMm) * BigInt(a.widthMm) * BigInt(a.heightMm);
    const vb = BigInt(b.lengthMm) * BigInt(b.widthMm) * BigInt(b.heightMm);
    return vb > va ? 1 : vb < va ? -1 : 0;
  });

  const epManager = new ExtremePointsManager();
  const voxelGrid = new VoxelGrid3D();
  const stackDag = new StackWeightDAG();

  const placements: PlacedItemState[] = [];
  let totalVolume = 0n;
  let totalWeight = 0;

  for (const item of sorted) {
    if (totalWeight + item.weightGram > container.maxPayloadGram) continue;

    const points = epManager.getPoints();
    const allowedRotations = item.rotatable ? [0, 1] : [0]; // Vertical axis rotation only
    let placed = false;

    for (const p of points) {
      for (const rot of allowedRotations) {
        const dims = getOrientedDimensions(item, rot);
        const box: Box3D = { x: p.x, y: p.y, z: p.z, w: dims.w, l: dims.l, h: dims.h };

        if (!isInsideContainer(box, container)) continue;
        if (voxelGrid.hasCollision(box)) continue;
        const sup = evaluateBottomSupport(box, voxelGrid.getAllBoxes(), 5, 8000);
        if (!sup.isSupported) continue;
        const dag = stackDag.canPlacePackage(item, box, 5);
        if (!dag.allowed) continue;

        voxelGrid.insert(box);
        epManager.update(box, voxelGrid.getAllBoxes(), container, 5);
        stackDag.addPlacement(item, box, 5);

        placements.push({ item, box, rotation: rot });
        totalVolume += BigInt(box.w) * BigInt(box.l) * BigInt(box.h);
        totalWeight += item.weightGram;
        placed = true;
        break;
      }
      if (placed) break;
    }
  }

  const containerVolume = BigInt(container.innerLengthMm) * BigInt(container.innerWidthMm) * BigInt(container.innerHeightMm);
  const fillRateBps = Number((totalVolume * 10000n) / containerVolume);
  const cog = calculateCenterOfGravity(placements, container);
  const cogViolation = cog.xPercentage < 45.0 || cog.xPercentage > 55.0;

  return {
    fillRateBps,
    centerOfGravity: cog,
    placedPackages: placements.map(p => ({
      packageId: p.item.id,
      xMm: p.box.x,
      yMm: p.box.y,
      zMm: p.box.z,
      placedLengthMm: p.box.w,
      placedWidthMm: p.box.l,
      placedHeightMm: p.box.h,
      rotation: p.rotation,
      layerIndex: Math.floor(p.box.z / 500),
    })),
    unplacedPackages: packages.filter(p => !placements.some(pl => pl.item.id === p.id)).map(p => ({ packageId: p.id, reason: 'NO_VALID_PLACEMENT' })),
    executionTimeMs: performance.now() - startTime,
    algorithmVersion: 'strategy-b-experienced',
    cogViolation,
    totalWeightGrams: totalWeight,
    totalVolumeMm3: totalVolume.toString(),
    iterationsExecuted: 1,
    watchdogTriggered: false,
  };
}

/**
 * Multi-container simulation: Packs packages until all are placed.
 * Returns { container1Result, totalContainersNeeded, totalTimeMs }.
 */
function evaluateStrategyMultiContainer(
  strategyName: 'A_MANUAL' | 'B_EXPERIENCED' | 'C_EXTREME_POINT',
  scenarioName: string,
  packFn: (c: ContainerDimension, pkgs: PackageItem[]) => PackingResult,
  dataset: PackageItem[],
): StrategyResult {
  let remaining = [...dataset];
  let containersNeeded = 0;
  let container1Result: PackingResult | null = null;
  let totalTimeMs = 0;

  while (remaining.length > 0) {
    containersNeeded++;
    const t0 = performance.now();
    const result = packFn(CONTAINER_40HC, remaining);
    const elapsed = performance.now() - t0;
    totalTimeMs += elapsed;

    if (containersNeeded === 1) {
      container1Result = result;
    }

    if (result.placedPackages.length === 0) {
      // Cannot place any more packages
      break;
    }

    const placedSet = new Set(result.placedPackages.map(p => p.packageId));
    remaining = remaining.filter(p => !placedSet.has(p.id));
  }

  return {
    strategy: strategyName,
    scenario: scenarioName,
    container1FillRatePct: Number(((container1Result?.fillRateBps ?? 0) / 100).toFixed(2)),
    container1PlacedCount: container1Result?.placedPackages.length ?? 0,
    totalPackages: dataset.length,
    containersNeeded,
    container1CogX: container1Result?.centerOfGravity.xPercentage ?? 0,
    totalTimeMs: Number(totalTimeMs.toFixed(2)),
  };
}

// -------------------------------------------------------------
// Dataset Generators with Fixed Seeds
// -------------------------------------------------------------

function generateScenario1Homogeneous(): PackageItem[] {
  const pkgs: PackageItem[] = [];
  for (let i = 1; i <= 120; i++) {
    pkgs.push({
      id: `HOMO-${String(i).padStart(4, '0')}`,
      lengthMm: 600,
      widthMm: 400,
      heightMm: 400,
      weightGram: 25000,
      fragile: false,
      noStack: false,
      rotatable: true,
      dropOrder: 1,
    });
  }
  return pkgs;
}

function generateScenario2Mixed(): PackageItem[] {
  const pkgs: PackageItem[] = [];
  // Deterministic LCG
  let seed = 424242;
  function pseudoRandom(min: number, max: number): number {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const r = (seed >>> 0) / 4294967296;
    return Math.floor(r * (max - min + 1)) + min;
  }

  for (let i = 1; i <= 150; i++) {
    const l = Math.round(pseudoRandom(300, 1200) / 50) * 50;
    const w = Math.round(pseudoRandom(300, 1200) / 50) * 50;
    const h = Math.round(pseudoRandom(300, 1200) / 50) * 50;

    // Weight proportional to volume: density ~ 200 kg/m^3
    const volM3 = (l * w * h) / 1e9;
    const weightGram = Math.max(5000, Math.round(volM3 * 200 * 1000));

    const fragile = (i % 7 === 0); // ~15%
    const noStack = (i % 10 === 0); // 10%

    pkgs.push({
      id: `MIX-${String(i).padStart(4, '0')}`,
      lengthMm: l,
      widthMm: w,
      heightMm: h,
      weightGram,
      fragile,
      noStack,
      rotatable: !fragile,
      dropOrder: (i % 3) + 1,
    });
  }
  return pkgs;
}

function generateScenario3Difficult(): PackageItem[] {
  const pkgs: PackageItem[] = [];
  let seed = 777888;
  function pseudoRandom(min: number, max: number): number {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const r = (seed >>> 0) / 4294967296;
    return Math.floor(r * (max - min + 1)) + min;
  }

  for (let i = 1; i <= 80; i++) {
    let l: number, w: number, h: number;
    const isOddShaped = i <= 40; // 50% are aspect ratio > 5

    if (isOddShaped) {
      l = pseudoRandom(1800, 2400);
      w = pseudoRandom(200, 350);
      h = pseudoRandom(200, 300);
    } else {
      l = pseudoRandom(600, 1200);
      w = pseudoRandom(500, 1000);
      h = pseudoRandom(400, 800);
    }

    const noStack = (i % 3 === 0); // ~30%
    const volM3 = (l * w * h) / 1e9;
    const weightGram = Math.max(8000, Math.round(volM3 * 220 * 1000));

    pkgs.push({
      id: `DIFF-${String(i).padStart(4, '0')}`,
      lengthMm: l,
      widthMm: w,
      heightMm: h,
      weightGram,
      fragile: isOddShaped,
      noStack,
      rotatable: true,
      dropOrder: (i % 2) + 1,
    });
  }
  return pkgs;
}

// -------------------------------------------------------------
// Test Suite & Benchmark Runner
// -------------------------------------------------------------

describe('Comparison Benchmark (Strategy A vs B vs C)', () => {
  it('Run full 3 strategies on 3 scenarios', () => {
    const s1 = generateScenario1Homogeneous();
    const s2 = generateScenario2Mixed();
    const s3 = generateScenario3Difficult();

    const scenarios = [
      { name: '1. Hàng đồng nhất (120 thùng 600x400x400)', data: s1 },
      { name: '2. Hàng hỗn hợp (150 kiện ngẫu nhiên 300-1200mm)', data: s2 },
      { name: '3. Hàng khó (80 kiện, tỷ lệ cạnh > 5, 30% noStack)', data: s3 },
    ];

    const allResults: StrategyResult[] = [];

    for (const sc of scenarios) {
      // Strategy A
      const resA = evaluateStrategyMultiContainer('A_MANUAL', sc.name, (c, p) => packStrategyA(c, p), sc.data);
      allResults.push(resA);

      // Strategy B
      const resB = evaluateStrategyMultiContainer('B_EXPERIENCED', sc.name, (c, p) => packStrategyB(c, p), sc.data);
      allResults.push(resB);

      // Strategy C
      const resC = evaluateStrategyMultiContainer('C_EXTREME_POINT', sc.name, (c, p) => packContainers(c, p), sc.data);
      allResults.push(resC);
    }

    // 1. Output raw JSON to docs/benchmark-results.json
    const docsDir = path.resolve(__dirname, '../../../docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    const jsonPath = path.join(docsDir, 'benchmark-results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(allResults, null, 2), 'utf-8');

    // 2. Generate Markdown table
    let md = '\n\n### BẢNG KẾT QUẢ SO SÁNH 3 CHIẾN LƯỢC XẾP HÀNG (ISO 40HC)\n\n';
    md += '| Kịch Bản | Chiến Lược | Lấp Đầy Cont 1 (%) | Kiện Đặt Cont 1 | Số Cont Cần Chở | CoG X (%) | Thời Gian (ms) | Chênh Lệch Fill (C - A) | Cont Tiết Kiệm (A - C) |\n';
    md += '| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n';

    for (let i = 0; i < scenarios.length; i++) {
      const a = allResults[i * 3];
      const b = allResults[i * 3 + 1];
      const c = allResults[i * 3 + 2];

      const deltaFillCA = (c.container1FillRatePct - a.container1FillRatePct).toFixed(2);
      const savedCont = a.containersNeeded - c.containersNeeded;

      const deltaStr = Number(deltaFillCA) >= 0 ? `+${deltaFillCA}%` : `${deltaFillCA}%`;
      const savedStr = savedCont > 0 ? `**-${savedCont} cont**` : savedCont === 0 ? '0 cont' : `+${-savedCont} cont`;

      md += `| **${scenarios[i].name}** | **A — Thủ công (Baseline)** | ${a.container1FillRatePct.toFixed(2)}% | ${a.container1PlacedCount}/${a.totalPackages} | ${a.containersNeeded} | ${a.container1CogX.toFixed(2)}% | ${a.totalTimeMs.toFixed(0)} ms | — | — |\n`;
      md += `| | **B — Có kinh nghiệm** | ${b.container1FillRatePct.toFixed(2)}% | ${b.container1PlacedCount}/${b.totalPackages} | ${b.containersNeeded} | ${b.container1CogX.toFixed(2)}% | ${b.totalTimeMs.toFixed(0)} ms | — | — |\n`;
      md += `| | **C — Extreme Point Engine** | **${c.container1FillRatePct.toFixed(2)}%** | **${c.container1PlacedCount}/${c.totalPackages}** | **${c.containersNeeded}** | **${c.container1CogX.toFixed(2)}%** | **${c.totalTimeMs.toFixed(0)} ms** | **${deltaStr}** | ${savedStr} |\n`;
    }

    console.log(md);
    console.log(`\nRaw results saved to: ${jsonPath}\n`);
  }, 60000);
});
