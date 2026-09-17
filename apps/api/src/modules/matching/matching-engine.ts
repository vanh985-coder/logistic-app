export interface CandidatePackage {
  id: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightGrams: number;
  isFragile?: boolean;
  noStack?: boolean;
}

export interface CandidateShipment {
  id: string;
  trackingCode: string;
  laneId: string;
  volumeMm3: bigint;
  weightGrams: bigint;
  totalPackages: number;
  packages: CandidatePackage[];
  companyId: string;
}

export interface ContainerSpec {
  id: string;
  code: string;
  name: string;
  innerLengthMm: number;
  innerWidthMm: number;
  innerHeightMm: number;
  volumeMm3: bigint;
  maxPayloadGram: bigint;
  tareWeightGram: bigint;
}

export interface ConsolidationPlan {
  container: ContainerSpec;
  shipments: CandidateShipment[];
  totalVolumeMm3: bigint;
  totalWeightGrams: bigint;
  volumeFillBps: number;
  weightFillBps: number;
}

/**
 * Preliminary volumetric ceiling for Phase 3 1D consolidation matching (95.00% = 9500 bps).
 *
 * ARCHITECTURAL CLARIFICATION:
 * - Phase 3 performs 1D greedy preliminary knapsack aggregation based purely on total volume (CBM)
 *   and gross weight (kg). A ceiling of 95.00% is applied as a preliminary tolerance buffer
 *   to avoid over-stuffing before 3D spatial feasibility is solved.
 * - In contrast, the market commitment KPI of >= 92% is a MINIMUM TARGET FLOOR enforced
 *   in Phase 4 by the 3D Extreme Point packing engine (which calculates exact 3D coordinates (x, y, z),
 *   center of gravity, load-bearing sequence, and orientation).
 */
export const MAX_PRELIMINARY_FILL_BPS = 9500; // 95.00%

export class MatchingEngine {
  /**
   * Check if an individual package can physically enter the container door & interior.
   */
  static canPackageFitContainer(pkg: CandidatePackage, container: ContainerSpec): boolean {
    const sortedPkg = [pkg.lengthMm, pkg.widthMm, pkg.heightMm].sort((a, b) => a - b);
    const sortedCont = [
      container.innerLengthMm,
      container.innerWidthMm,
      container.innerHeightMm,
    ].sort((a, b) => a - b);

    // If package smallest dim > container smallest dim, or middle > middle, or largest > largest
    return (
      sortedPkg[0] <= sortedCont[0] &&
      sortedPkg[1] <= sortedCont[1] &&
      sortedPkg[2] <= sortedCont[2]
    );
  }

  /**
   * Check if all packages of a shipment can physically fit inside the container.
   */
  static canShipmentFitContainer(shipment: CandidateShipment, container: ContainerSpec): boolean {
    if (shipment.volumeMm3 > container.volumeMm3) return false;
    if (shipment.weightGrams > container.maxPayloadGram) return false;

    for (const pkg of shipment.packages) {
      if (!this.canPackageFitContainer(pkg, container)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Select the optimal container type for a given volume and candidate shipments.
   * Priority:
   * 1. If any package exceeds 40DC height (2,393 mm), 40HC is mandatory.
   * 2. If volume <= 30 CBM and weight <= 28.2 tons: 20DC.
   * 3. If volume <= 62 CBM and weight <= 26.7 tons: 40DC.
   * 4. Otherwise: 40HC.
   */
  static selectBestContainer(
    shipments: CandidateShipment[],
    containers: ContainerSpec[],
  ): ContainerSpec | null {
    if (containers.length === 0 || shipments.length === 0) return null;

    const c20DC = containers.find((c) => c.code === '20DC');
    const c40DC = containers.find((c) => c.code === '40DC');
    const c40HC = containers.find((c) => c.code === '40HC');

    // Check for high cube requirement (package height > 2393 mm)
    const requiresHighCube = shipments.some((s) =>
      s.packages.some((p) => {
        const dims = [p.lengthMm, p.widthMm, p.heightMm].sort((a, b) => a - b);
        // If the second largest dimension > 2352 (width) or smallest > 2393, needs HC
        return dims[1] > 2352 || dims[2] > 2393;
      }),
    );

    if (requiresHighCube && c40HC) {
      return c40HC;
    }

    const totalVolume = shipments.reduce((sum, s) => sum + s.volumeMm3, 0n);
    const totalWeight = shipments.reduce((sum, s) => sum + s.weightGrams, 0n);

    // 20DC volume limit: ~30.5 CBM (30,500,000,000 mm3) and payload 28,200,000g
    const limit20DC_Volume = 30_500_000_000n;
    if (
      c20DC &&
      totalVolume <= limit20DC_Volume &&
      totalWeight <= c20DC.maxPayloadGram &&
      shipments.every((s) => this.canShipmentFitContainer(s, c20DC))
    ) {
      return c20DC;
    }

    // 40DC volume limit: ~62.3 CBM (62,300,000,000 mm3) and payload 26,700,000g
    const limit40DC_Volume = 62_300_000_000n;
    if (
      c40DC &&
      totalVolume <= limit40DC_Volume &&
      totalWeight <= c40DC.maxPayloadGram &&
      shipments.every((s) => this.canShipmentFitContainer(s, c40DC))
    ) {
      return c40DC;
    }

    return c40HC || c40DC || c20DC || containers[0];
  }

  /**
   * Greedy Best-Fit Decreasing heuristic to build a ConsolidationPlan for a given container.
   */
  static buildConsolidationPlan(
    candidateShipments: CandidateShipment[],
    container: ContainerSpec,
  ): ConsolidationPlan | null {
    if (candidateShipments.length === 0) return null;

    // Filter shipments that can fit the container individually
    const eligibleShipments = candidateShipments.filter((s) =>
      this.canShipmentFitContainer(s, container),
    );

    if (eligibleShipments.length === 0) return null;

    // Sort by volume descending (greedy best-fit)
    const sorted = [...eligibleShipments].sort((a, b) => {
      if (b.volumeMm3 > a.volumeMm3) return 1;
      if (b.volumeMm3 < a.volumeMm3) return -1;
      return Number(b.weightGrams - a.weightGrams);
    });

    const maxUsableVolume = (container.volumeMm3 * BigInt(MAX_PRELIMINARY_FILL_BPS)) / 10000n;

    const selected: CandidateShipment[] = [];
    let currentVolume = 0n;
    let currentWeight = 0n;

    for (const s of sorted) {
      if (
        currentVolume + s.volumeMm3 <= maxUsableVolume &&
        currentWeight + s.weightGrams <= container.maxPayloadGram
      ) {
        selected.push(s);
        currentVolume += s.volumeMm3;
        currentWeight += s.weightGrams;
      }
    }

    if (selected.length === 0) return null;

    const volumeFillBps = Number((currentVolume * 10000n) / container.volumeMm3);
    const weightFillBps = Number((currentWeight * 10000n) / container.maxPayloadGram);

    return {
      container,
      shipments: selected,
      totalVolumeMm3: currentVolume,
      totalWeightGrams: currentWeight,
      volumeFillBps,
      weightFillBps,
    };
  }
}
