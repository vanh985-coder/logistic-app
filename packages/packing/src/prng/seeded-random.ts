/**
 * Deterministic PRNG using SplitMix32.
 * Produces identical sequences of pseudo-random numbers given the same seed.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 0x12345678;
    }
  }

  /**
   * Generates next float in range [0, 1).
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns random integer in range [min, max] inclusive.
   */
  nextInt(min: number, max: number): number {
    if (min >= max) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /**
   * Shuffles an array in-place deterministically using Fisher-Yates algorithm.
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }
}

/**
 * Computes a 32-bit deterministic hash from any input string (CRC32-like FNV-1a).
 */
export function computeFingerprintSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
