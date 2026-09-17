/**
 * Strict Round-Half-Up integer division for positive BigInts:
 * roundDiv(a, b) = floor((a + floor(b / 2)) / b)
 */
export function roundDiv(a: bigint, b: bigint): bigint {
  if (b <= 0n) {
    throw new Error('Divisor must be positive for integer division');
  }
  if (a < 0n) {
    throw new Error('Dividend cannot be negative for financial pricing');
  }
  return (a + b / 2n) / b;
}

/**
 * Calculates volume in cubic millimeters (mm3) as BigInt.
 */
export function calcVolumeMm3(lengthMm: number, widthMm: number, heightMm: number): bigint {
  const l = BigInt(Math.round(Math.max(0, lengthMm)));
  const w = BigInt(Math.round(Math.max(0, widthMm)));
  const h = BigInt(Math.round(Math.max(0, heightMm)));
  return l * w * h;
}

/**
 * Calculates the ratio of the longest edge to the shortest edge.
 * Returns 1 if all edges equal, or 0 if any edge is non-positive.
 */
export function calcEdgeRatio(lengthMm: number, widthMm: number, heightMm: number): number {
  const edges = [lengthMm, widthMm, heightMm].sort((a, b) => b - a);
  const maxEdge = edges[0];
  const minEdge = edges[2];

  if (minEdge <= 0 || maxEdge <= 0) {
    return 0;
  }
  return maxEdge / minEdge;
}

/**
 * Derived display helper: converts volumeMm3 to CBM (m3) string for UI/reporting.
 */
export function cbmFromVolumeMm3(volumeMm3: bigint, precision: number = 4): string {
  const cbm = Number(volumeMm3) / 1_000_000_000;
  return cbm.toFixed(precision);
}

/**
 * Derived display helper: converts weightGrams to kg string for UI/reporting.
 */
export function kgFromWeightGrams(weightGrams: bigint | number, precision: number = 2): string {
  const kg = Number(weightGrams) / 1000;
  return kg.toFixed(precision);
}
