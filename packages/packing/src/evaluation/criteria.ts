import {
  ContainerDimension,
  PackageItem,
  PackingResult,
  PackingStrategy,
  StrategyEvaluation,
  CriterionResult,
  QualitativeRating,
} from '../geometry/types';
import { Box3D } from '../geometry/aabb';
import { evaluateBottomSupport } from '../physics/support-calc';

export interface PlacedPackageWithBox {
  item: PackageItem;
  box: Box3D;
  rotation: number;
}

const RATING_MAP: Record<QualitativeRating, string> = {
  VERY_GOOD: 'Rất tốt',
  GOOD: 'Tốt',
  FAIR: 'Khá',
  AVERAGE: 'Trung bình',
  POOR: 'Kém',
};

function getRating(
  score: number,
  thresholds: [number, number, number, number],
  lowerIsBetter = false,
): QualitativeRating {
  const [vg, g, f, a] = thresholds;
  if (!lowerIsBetter) {
    if (score >= vg) return 'VERY_GOOD';
    if (score >= g) return 'GOOD';
    if (score >= f) return 'FAIR';
    if (score >= a) return 'AVERAGE';
    return 'POOR';
  } else {
    if (score <= vg) return 'VERY_GOOD';
    if (score <= g) return 'GOOD';
    if (score <= f) return 'FAIR';
    if (score <= a) return 'AVERAGE';
    return 'POOR';
  }
}

export function evaluateAccessibility(placements: PlacedPackageWithBox[]): number {
  if (placements.length === 0) return 100;

  const companyGroups = new Map<string, PlacedPackageWithBox[]>();
  for (const p of placements) {
    const cId = p.item.companyId || 'DEFAULT';
    if (!companyGroups.has(cId)) companyGroups.set(cId, []);
    companyGroups.get(cId)!.push(p);
  }

  let totalVolAll = 0;
  let weightedGroupingRatio = 0;

  for (const [_, items] of companyGroups.entries()) {
    const n = items.length;
    let vol_c = 0;
    for (const it of items) vol_c += it.box.w * it.box.l * it.box.h;
    totalVolAll += vol_c;

    if (n <= 1) {
      weightedGroupingRatio += vol_c * 1.0;
      continue;
    }

    const adj: number[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const bi = items[i].box;
        const bj = items[j].box;
        const dx = Math.max(0, Math.max(bi.x, bj.x) - Math.min(bi.x + bi.w, bj.x + bj.w));
        const dy = Math.max(0, Math.max(bi.y, bj.y) - Math.min(bi.y + bi.l, bj.y + bj.l));
        const dz = Math.max(0, Math.max(bi.z, bj.z) - Math.min(bi.z + bi.h, bj.z + bj.h));
        if (dx <= 100 && dy <= 100 && dz <= 100) {
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }

    const visited = new Set<number>();
    let clusters = 0;
    for (let i = 0; i < n; i++) {
      if (!visited.has(i)) {
        clusters++;
        const q = [i];
        visited.add(i);
        while (q.length > 0) {
          const curr = q.shift()!;
          for (const nb of adj[curr]) {
            if (!visited.has(nb)) {
              visited.add(nb);
              q.push(nb);
            }
          }
        }
      }
    }
    const ratio = 1 - (clusters - 1) / (n - 1);
    weightedGroupingRatio += vol_c * ratio;
  }

  return totalVolAll > 0 ? (weightedGroupingRatio / totalVolAll) * 100 : 100;
}

export function evaluateLifo(placements: PlacedPackageWithBox[]): number {
  if (placements.length === 0) return 100;

  let lifoPairs = 0;
  let lifoViolations = 0;

  for (let i = 0; i < placements.length; i++) {
    const pi = placements[i];
    const di = pi.item.dropOrder ?? 1;

    for (let j = 0; j < placements.length; j++) {
      if (i === j) continue;
      const pj = placements[j];
      const dj = pj.item.dropOrder ?? 1;

      // di < dj means pi needs to be dropped BEFORE pj
      if (di < dj) {
        lifoPairs++;

        const yOverlap = Math.max(
          0,
          Math.min(pi.box.y + pi.box.l, pj.box.y + pj.box.l) - Math.max(pi.box.y, pj.box.y),
        );
        const zOverlap = Math.max(
          0,
          Math.min(pi.box.z + pi.box.h, pj.box.z + pj.box.h) - Math.max(pi.box.z, pj.box.z),
        );
        // pj blocks pi from door (+X direction)
        const xBlocks = pj.box.x > pi.box.x && yOverlap > 0 && zOverlap > 0;

        const xOverlap = Math.max(
          0,
          Math.min(pi.box.x + pi.box.w, pj.box.x + pj.box.w) - Math.max(pi.box.x, pj.box.x),
        );
        // pj sits on top of pi (+Z direction)
        const zBlocks = pj.box.z > pi.box.z && xOverlap > 0 && yOverlap > 0;

        if (xBlocks || zBlocks) {
          lifoViolations++;
        }
      }
    }
  }

  return lifoPairs === 0 ? 100 : Math.max(0, (1 - lifoViolations / lifoPairs) * 100);
}

export function evaluateStability(
  container: ContainerDimension,
  placements: PlacedPackageWithBox[],
): number {
  if (placements.length === 0) return 100;

  const H = container.innerHeightMm;
  const boxes = placements.map((p) => p.box);
  let totalSupport = 0;
  let lowTierWeight = 0;
  let totalWeight = 0;

  for (const p of placements) {
    const s = evaluateBottomSupport(p.box, boxes, 5, 0);
    totalSupport += s.supportRatioBps / 10000;
    totalWeight += p.item.weightGram;
    if (p.box.z + p.box.h / 2 <= H / 2) {
      lowTierWeight += p.item.weightGram;
    }
  }

  const meanSupport = totalSupport / placements.length;
  const lowWeightRatio = totalWeight > 0 ? lowTierWeight / totalWeight : 1;
  return Math.round((0.6 * meanSupport + 0.4 * lowWeightRatio) * 10000) / 100;
}

export function evaluateCargoCompatibility(placements: PlacedPackageWithBox[]): number {
  if (placements.length === 0) return 100;

  let contactPairs = 0;
  let penaltyPoints = 0;

  for (let i = 0; i < placements.length; i++) {
    const pi = placements[i];
    const vol_i = pi.box.w * pi.box.l * pi.box.h;
    const rho_i = vol_i > 0 ? pi.item.weightGram / vol_i : 0;

    for (let j = 0; j < placements.length; j++) {
      if (i === j) continue;
      const pj = placements[j];
      const zContact = Math.abs(pj.box.z - (pi.box.z + pi.box.h)) <= 5;
      const xOverlap = Math.max(
        0,
        Math.min(pi.box.x + pi.box.w, pj.box.x + pj.box.w) - Math.max(pi.box.x, pj.box.x),
      );
      const yOverlap = Math.max(
        0,
        Math.min(pi.box.y + pi.box.l, pj.box.y + pj.box.l) - Math.max(pi.box.y, pj.box.y),
      );

      if (zContact && xOverlap > 0 && yOverlap > 0) {
        contactPairs++;
        if (pi.item.fragile || pi.item.noStack) {
          penaltyPoints += 1.0;
        } else {
          const vol_j = pj.box.w * pj.box.l * pj.box.h;
          const rho_j = vol_j > 0 ? pj.item.weightGram / vol_j : 0;
          if (rho_j > 1.3 * rho_i && rho_i > 0) {
            penaltyPoints += Math.min(1.0, (rho_j - 1.3 * rho_i) / rho_i);
          }
        }
      }
    }
  }

  if (contactPairs === 0) return 100;
  return Math.max(0, Math.round((1 - penaltyPoints / contactPairs) * 10000) / 100);
}

export function evaluateStrategyCriteria(
  container: ContainerDimension,
  totalPackages: PackageItem[],
  result: PackingResult,
  strategy: PackingStrategy,
): StrategyEvaluation {
  const itemMap = new Map<string, PackageItem>();
  for (const pkg of totalPackages) {
    itemMap.set(pkg.id, pkg);
  }

  const placements: PlacedPackageWithBox[] = result.placedPackages
    .filter((p) => itemMap.has(p.packageId))
    .map((p) => ({
      item: itemMap.get(p.packageId)!,
      box: {
        x: p.xMm,
        y: p.yMm,
        z: p.zMm,
        w: p.placedLengthMm,
        l: p.placedWidthMm,
        h: p.placedHeightMm,
      },
      rotation: p.rotation,
    }));

  const placedCount = result.placedPackages.length;
  const totalCount = totalPackages.length;
  const unplacedCount = totalCount - placedCount;
  const placedPercentage = totalCount > 0 ? Math.round((placedCount / totalCount) * 10000) / 100 : 0;

  const unplacedAlert: 'NONE' | 'WARNING' | 'CRITICAL' =
    totalCount > 0 && unplacedCount / totalCount > 0.10
      ? 'CRITICAL'
      : unplacedCount > 0
        ? 'WARNING'
        : 'NONE';

  const unplacedNote =
    unplacedCount > 0
      ? `Số kiện xếp được: ${placedCount}/${totalCount} (bỏ lại ${unplacedCount} kiện — cần thêm container)`
      : `Số kiện xếp được: ${placedCount}/${totalCount} (xếp hết 100% kiện)`;

  // 1. Không gian (Fill Rate)
  const volScore = Math.round((result.fillRateBps / 100) * 100) / 100;
  const volRating = getRating(volScore, [85, 75, 65, 50]);
  const volumeUtilization: CriterionResult = {
    id: 'volumeUtilization',
    name: 'Không gian',
    rawScore: volScore,
    unit: '%',
    rating: volRating,
    ratingLabel: RATING_MAP[volRating],
    description: 'Tỷ lệ thể tích hàng thực tế chiếm chỗ so với dung tích lòng container (CBM).',
  };

  // 2. Khai thác tải trọng (Payload)
  const maxPayload = container.maxPayloadGram > 0 ? container.maxPayloadGram : 26500000;
  const wtScore = Math.round((result.totalWeightGrams / maxPayload) * 10000) / 100;
  const wtRating = getRating(wtScore, [80, 60, 40, 20]);
  const weightUtilization: CriterionResult = {
    id: 'weightUtilization',
    name: 'Khai thác tải trọng',
    rawScore: wtScore,
    unit: '%',
    rating: wtRating,
    ratingLabel: RATING_MAP[wtRating],
    description:
      'Tỷ lệ tải trọng hàng so với tải trọng tối đa cho phép của container. Lưu ý: Phản ánh bản chất hàng hóa (hàng thể tích vs hàng tỷ trọng cao), không phải lỗi thuật toán.',
  };

  // 3. Trọng tâm (CoG 3-axis deviation with Z > 45% penalty)
  const cog = result.centerOfGravity;
  const zOver = Math.max(0, cog.zPercentage - 45.0);
  const cogDev = Math.sqrt(
    Math.pow(cog.xPercentage - 50.0, 2) +
    Math.pow(cog.yPercentage - 50.0, 2) +
    Math.pow(zOver, 2),
  );
  const cogScore = Math.round(cogDev * 100) / 100;
  const cogRating = getRating(cogScore, [3, 5, 8, 12], true);
  const cogAlert: 'NORMAL' | 'WARNING' | 'CRITICAL' =
    result.cogViolation || cogScore > 10 ? 'CRITICAL' : cogScore > 5 ? 'WARNING' : 'NORMAL';
  const cogDeviation: CriterionResult = {
    id: 'cogDeviation',
    name: 'Trọng tâm',
    rawScore: cogScore,
    unit: '%',
    rating: cogRating,
    ratingLabel: RATING_MAP[cogRating],
    description: `Độ lệch trọng tâm tổng thể 3 trục (X=${cog.xPercentage.toFixed(1)}%, Y=${cog.yPercentage.toFixed(1)}%, Z=${cog.zPercentage.toFixed(1)}%). Độ lệch thấp giúp container cân bằng và an toàn khi vận chuyển.`,
    alertLevel: cogAlert,
  };

  // 4. Ổn định (Stability Score)
  const stabScore = evaluateStability(container, placements);
  const stabRating = getRating(stabScore, [85, 75, 65, 50]);
  const stabilityScore: CriterionResult = {
    id: 'stabilityScore',
    name: 'Ổn định',
    rawScore: stabScore,
    unit: '%',
    rating: stabRating,
    ratingLabel: RATING_MAP[stabRating],
    description:
      'Chỉ số kết hợp giữa diện tích tiếp xúc nâng đỡ đáy (60%) và tỷ trọng hàng nặng dồn về nửa dưới container (40%).',
  };

  // 5. Tương thích hàng (Cargo Compatibility)
  const compatScore = evaluateCargoCompatibility(placements);
  const compatRating = getRating(compatScore, [95, 85, 75, 60]);
  const cargoCompatibility: CriterionResult = {
    id: 'cargoCompatibility',
    name: 'Tương thích hàng',
    rawScore: compatScore,
    unit: '%',
    rating: compatRating,
    ratingLabel: RATING_MAP[compatRating],
    description:
      'Độ tương thích cơ học giữa các lớp hàng xếp chồng. Các ràng buộc an toàn (hàng dễ vỡ, không được chồng, giới hạn tải chịu lực) được động cơ thuật toán bảo đảm 100%.',
  };

  // 6. Thứ tự dỡ (LIFO Compliance)
  const lifoScore = Math.round(evaluateLifo(placements) * 100) / 100;
  const lifoRating = getRating(lifoScore, [90, 80, 70, 50]);
  const lifoCompliance: CriterionResult = {
    id: 'lifoCompliance',
    name: 'Thứ tự dỡ',
    rawScore: lifoScore,
    unit: '%',
    rating: lifoRating,
    ratingLabel: RATING_MAP[lifoRating],
    description:
      'Tỷ lệ tuân thủ thứ tự dỡ hàng LIFO (Last-In, First-Out). Kiện dỡ trước (dropOrder nhỏ hơn) phải nằm gần cửa container và phía trên, không bị kiện dỡ sau che chắn.',
  };

  // 7. Khả năng tiếp cận (Consignee Accessibility)
  const accessScore = Math.round(evaluateAccessibility(placements) * 100) / 100;
  const accessRating = getRating(accessScore, [85, 70, 55, 40]);
  const consigneeAccessibility: CriterionResult = {
    id: 'consigneeAccessibility',
    name: 'Khả năng tiếp cận',
    rawScore: accessScore,
    unit: '%',
    rating: accessRating,
    ratingLabel: RATING_MAP[accessRating],
    description:
      'Mức độ gom cụm liền khối hàng hóa của từng chủ hàng. Điểm càng cao thì hàng của một chủ càng nằm tập trung, tiết kiệm thời gian phân loại và kiểm đếm tại kho CFS.',
  };

  const strategyMeta: Record<PackingStrategy, { name: string; desc: string }> = {
    MAX_VOLUME: {
      name: 'Tối ưu thể tích (Max Volume)',
      desc: 'Tối đa hóa không gian xếp hàng và tỷ lệ lấp đầy (Fill Rate) của container.',
    },
    CONSIGNEE_GROUPED: {
      name: 'Gom theo chủ hàng (Consignee Grouped)',
      desc: 'Xếp hàng của cùng một chủ hàng liền khối, thuận tiện kiểm đếm và bàn giao tại kho CFS.',
    },
    LIFO_PRIORITY: {
      name: 'Ưu tiên thứ tự dỡ (LIFO Priority)',
      desc: 'Xếp hàng theo chặng giao hàng, kiện giao trước nằm ngoài cửa và trên cùng, dỡ không cần bốc dỡ lại hàng khác.',
    },
  };

  return {
    strategy,
    strategyName: strategyMeta[strategy].name,
    strategyDescription: strategyMeta[strategy].desc,
    placedCount,
    totalCount,
    unplacedCount,
    placedPercentage,
    unplacedAlert,
    unplacedNote,
    criteria: {
      volumeUtilization,
      weightUtilization,
      cogDeviation,
      stabilityScore,
      cargoCompatibility,
      lifoCompliance,
      consigneeAccessibility,
    },
  };
}
