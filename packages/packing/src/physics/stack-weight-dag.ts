import { Box3D } from '../geometry/aabb';
import { PackageItem } from '../geometry/types';
import { evaluateBottomSupport, DEFAULT_CONTACT_TOLERANCE_MM } from './support-calc';

export interface PlacedNode {
  index: number;
  package: PackageItem;
  box: Box3D;
  directSupportingIndices: number[]; // indices of packages directly underneath this one
  supportFractions: number[]; // fraction of this package's weight on each supporting package (sum = 1.0)
}

/**
 * Directed Acyclic Graph (DAG) modeling vertical load transmission.
 * When package v rests on package u, the fraction of v's weight transmitted to u is:
 *   c_vu = Area(R_v ∩ R_u) / Area(R_v)
 * where the denominator is the BOTTOM AREA OF THE UPPER PACKAGE (R_v).
 *
 * Case 1: If v rests entirely on a single package u, c_vu = 1.0 (100% of v's weight is transmitted to u,
 *         regardless of what percentage of u's top surface is covered).
 * Case 2: If v bridges across packages u1 and u2, the weight is partitioned proportionally
 *         by the fraction of v's bottom area over each (normalized such that sum = 1.0).
 */
export class StackWeightDAG {
  private nodes: PlacedNode[] = [];

  /**
   * Evaluates if a new candidate package can be placed without violating:
   * 1. noStack flags on any supporting package
   * 2. maxStackWeightGram limits on any affected package down the support chain
   */
  canPlacePackage(
    candidateItem: PackageItem,
    candidateBox: Box3D,
    contactToleranceMm = DEFAULT_CONTACT_TOLERANCE_MM,
  ): { allowed: boolean; reason?: string } {
    // Floor placement never violates underneath limits (there are none)
    if (candidateBox.z === 0) {
      return { allowed: true };
    }

    const placedBoxes = this.nodes.map((n) => n.box);
    const supportEval = evaluateBottomSupport(candidateBox, placedBoxes, contactToleranceMm);

    if (!supportEval.isSupported) {
      return { allowed: false, reason: 'INSUFFICIENT_SUPPORT' };
    }

    // 1. Check noStack rule: No package can be placed on top of a noStack package
    for (const supIdx of supportEval.supportingBoxIndices) {
      const supportingNode = this.nodes[supIdx];
      if (supportingNode.package.noStack) {
        return {
          allowed: false,
          reason: `Package "${supportingNode.package.id}" has noStack=true and cannot bear load`,
        };
      }
    }

    // 2. Compute load distribution fractions for candidate
    const totalArea = supportEval.supportAreas.reduce((sum, a) => sum + a, 0);
    if (totalArea <= 0) {
      return { allowed: false, reason: 'ZERO_SUPPORT_AREA' };
    }

    // Normalized fractions ensuring 100% of candidate weight is accounted for
    const candidateFractions = supportEval.supportAreas.map((a) => a / totalArea);

    // 3. Tentatively calculate cumulative overhead load on all existing nodes
    // Build tentative graph with candidate included
    const tentativeLoads = this.calculateCumulativeLoads(
      candidateItem.weightGram,
      supportEval.supportingBoxIndices,
      candidateFractions,
    );

    for (let idx = 0; idx < this.nodes.length; idx++) {
      const node = this.nodes[idx];
      const maxAllowed = node.package.maxStackWeightGram;
      if (maxAllowed !== undefined && maxAllowed > 0) {
        if (tentativeLoads[idx] > maxAllowed) {
          return {
            allowed: false,
            reason: `Package "${node.package.id}" maxStackWeight exceeded (${tentativeLoads[idx]}g > ${maxAllowed}g)`,
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Adds an accepted placement into the DAG.
   */
  addPlacement(
    item: PackageItem,
    box: Box3D,
    contactToleranceMm = DEFAULT_CONTACT_TOLERANCE_MM,
  ): void {
    const placedBoxes = this.nodes.map((n) => n.box);
    const supportEval = evaluateBottomSupport(box, placedBoxes, contactToleranceMm);

    let fractions: number[] = [];
    if (box.z > 0 && supportEval.supportAreas.length > 0) {
      const totalArea = supportEval.supportAreas.reduce((sum, a) => sum + a, 0);
      fractions = supportEval.supportAreas.map((a) => (totalArea > 0 ? a / totalArea : 0));
    }

    this.nodes.push({
      index: this.nodes.length,
      package: item,
      box,
      directSupportingIndices: supportEval.supportingBoxIndices,
      supportFractions: fractions,
    });
  }

  /**
   * Calculates cumulative overhead loads on all existing nodes, optionally incorporating
   * a tentative new placement.
   */
  calculateCumulativeLoads(
    tentativeWeight = 0,
    tentativeSupportingIndices: number[] = [],
    tentativeFractions: number[] = [],
  ): number[] {
    const n = this.nodes.length;
    const loads = new Array<number>(n).fill(0);

    // Propagate tentative package weight if present
    if (tentativeWeight > 0) {
      for (let i = 0; i < tentativeSupportingIndices.length; i++) {
        const supIdx = tentativeSupportingIndices[i];
        const fraction = tentativeFractions[i] || 0;
        this.propagateWeightDown(supIdx, tentativeWeight * fraction, loads);
      }
    }

    // Propagate existing placements from highest z to lowest z
    const sortedIndices = [...Array(n).keys()].sort(
      (a, b) => this.nodes[b].box.z - this.nodes[a].box.z,
    );

    for (const idx of sortedIndices) {
      const node = this.nodes[idx];
      const totalWeightOnThisNode = node.package.weightGram + loads[idx];

      for (let s = 0; s < node.directSupportingIndices.length; s++) {
        const supIdx = node.directSupportingIndices[s];
        const fraction = node.supportFractions[s] || 0;
        this.propagateWeightDown(supIdx, totalWeightOnThisNode * fraction, loads);
      }
    }

    return loads;
  }

  private propagateWeightDown(targetIdx: number, weight: number, loads: number[]): void {
    loads[targetIdx] += Math.round(weight);
  }

  /**
   * Clears the DAG.
   */
  clear(): void {
    this.nodes = [];
  }
}
