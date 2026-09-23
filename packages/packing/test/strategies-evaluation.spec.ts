import { describe, it, expect } from 'vitest';
import {
  ContainerDimension,
  PackageItem,
  packContainers,
  packMultiStrategies,
  evaluateStrategyCriteria,
} from '../src/index';

const CONTAINER_40HC: ContainerDimension = {
  innerLengthMm: 12032,
  innerWidthMm: 2352,
  innerHeightMm: 2698,
  maxPayloadGram: 26500000,
};

describe('3 Packing Strategies & 7-Criteria Qualitative Evaluation', () => {
  const samplePackages: PackageItem[] = [
    // Shipper A (dropOrder 1 - near doors)
    {
      id: 'PKG-A1',
      sku: 'SKU-A1',
      companyId: 'COMP-A',
      dropOrder: 1,
      lengthMm: 1200,
      widthMm: 1000,
      heightMm: 1000,
      weightGram: 200000,
      fragile: false,
      noStack: false,
      rotatable: true,
    },
    {
      id: 'PKG-A2',
      sku: 'SKU-A2',
      companyId: 'COMP-A',
      dropOrder: 1,
      lengthMm: 1200,
      widthMm: 1000,
      heightMm: 1000,
      weightGram: 200000,
      fragile: false,
      noStack: false,
      rotatable: true,
    },
    // Shipper B (dropOrder 2 - middle)
    {
      id: 'PKG-B1',
      sku: 'SKU-B1',
      companyId: 'COMP-B',
      dropOrder: 2,
      lengthMm: 1100,
      widthMm: 900,
      heightMm: 900,
      weightGram: 180000,
      fragile: false,
      noStack: false,
      rotatable: true,
    },
    {
      id: 'PKG-B2',
      sku: 'SKU-B2',
      companyId: 'COMP-B',
      dropOrder: 2,
      lengthMm: 1100,
      widthMm: 900,
      heightMm: 900,
      weightGram: 180000,
      fragile: true,
      noStack: false,
      rotatable: true,
    },
    // Shipper C (dropOrder 3 - back wall)
    {
      id: 'PKG-C1',
      sku: 'SKU-C1',
      companyId: 'COMP-C',
      dropOrder: 3,
      lengthMm: 1000,
      widthMm: 800,
      heightMm: 800,
      weightGram: 150000,
      fragile: false,
      noStack: true,
      rotatable: true,
    },
    {
      id: 'PKG-C2',
      sku: 'SKU-C2',
      companyId: 'COMP-C',
      dropOrder: 3,
      lengthMm: 1000,
      widthMm: 800,
      heightMm: 800,
      weightGram: 150000,
      fragile: false,
      noStack: false,
      rotatable: true,
    },
  ];

  it('should evaluate all 7 criteria and include the top unplaced count row', () => {
    const result = packContainers(CONTAINER_40HC, samplePackages, { strategy: 'MAX_VOLUME' });
    expect(result.strategy).toBe('MAX_VOLUME');
    expect(result.evaluation).toBeDefined();

    const evalRes = result.evaluation!;
    expect(evalRes.placedCount).toBe(6);
    expect(evalRes.totalCount).toBe(6);
    expect(evalRes.unplacedCount).toBe(0);
    expect(evalRes.unplacedAlert).toBe('NONE');
    expect(evalRes.unplacedNote).toContain('Số kiện xếp được: 6/6');

    // Check all 7 criteria are present with numeric scores and qualitative labels
    const criteria = evalRes.criteria;
    expect(criteria.volumeUtilization.id).toBe('volumeUtilization');
    expect(criteria.volumeUtilization.unit).toBe('%');
    expect(criteria.volumeUtilization.rawScore).toBeGreaterThan(0);
    expect(criteria.volumeUtilization.ratingLabel).toBeDefined();

    expect(criteria.weightUtilization.id).toBe('weightUtilization');
    expect(criteria.weightUtilization.name).toBe('Khai thác tải trọng');
    expect(criteria.weightUtilization.rawScore).toBeGreaterThan(0);
    expect(criteria.weightUtilization.description).toContain('bản chất hàng hóa');

    expect(criteria.cogDeviation.id).toBe('cogDeviation');
    expect(criteria.cogDeviation.rawScore).toBeGreaterThanOrEqual(0);

    expect(criteria.stabilityScore.id).toBe('stabilityScore');
    expect(criteria.stabilityScore.rawScore).toBeGreaterThan(0);

    expect(criteria.cargoCompatibility.id).toBe('cargoCompatibility');
    expect(criteria.cargoCompatibility.rawScore).toBeGreaterThanOrEqual(0);

    expect(criteria.lifoCompliance.id).toBe('lifoCompliance');
    expect(criteria.lifoCompliance.rawScore).toBeGreaterThanOrEqual(0);

    expect(criteria.consigneeAccessibility.id).toBe('consigneeAccessibility');
    expect(criteria.consigneeAccessibility.rawScore).toBeGreaterThanOrEqual(0);
  });

  it('should flag CRITICAL alert when unplaced packages exceed 10%', () => {
    // Pack 15 oversized packages into a small container
    const smallContainer: ContainerDimension = {
      innerLengthMm: 2000,
      innerWidthMm: 1500,
      innerHeightMm: 1200,
      maxPayloadGram: 5000000,
    };
    const manyPackages: PackageItem[] = Array.from({ length: 15 }, (_, i) => ({
      id: `BIG-PKG-${i + 1}`,
      lengthMm: 1200,
      widthMm: 1000,
      heightMm: 1000,
      weightGram: 100000,
      fragile: false,
      noStack: false,
      rotatable: true,
    }));

    const result = packContainers(smallContainer, manyPackages, { strategy: 'MAX_VOLUME' });
    expect(result.evaluation).toBeDefined();
    const evalRes = result.evaluation!;
    expect(evalRes.unplacedCount).toBeGreaterThan(1);
    expect(evalRes.unplacedAlert).toBe('CRITICAL');
    expect(evalRes.unplacedNote).toContain('cần thêm container');
  });

  it('should execute packMultiStrategies across all 3 strategies', () => {
    const multiRes = packMultiStrategies(CONTAINER_40HC, samplePackages);

    expect(multiRes.strategies.MAX_VOLUME).toBeDefined();
    expect(multiRes.strategies.CONSIGNEE_GROUPED).toBeDefined();
    expect(multiRes.strategies.LIFO_PRIORITY).toBeDefined();

    expect(multiRes.strategies.MAX_VOLUME.strategy).toBe('MAX_VOLUME');
    expect(multiRes.strategies.CONSIGNEE_GROUPED.strategy).toBe('CONSIGNEE_GROUPED');
    expect(multiRes.strategies.LIFO_PRIORITY.strategy).toBe('LIFO_PRIORITY');

    expect(['MAX_VOLUME', 'CONSIGNEE_GROUPED', 'LIFO_PRIORITY']).toContain(
      multiRes.recommendedStrategy,
    );
    expect(multiRes.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty package array gracefully', () => {
    const result = packContainers(CONTAINER_40HC, []);
    expect(result.fillRateBps).toBe(0);
    expect(result.placedPackages.length).toBe(0);
    expect(result.evaluation).toBeDefined();
    expect(result.evaluation!.placedCount).toBe(0);
    expect(result.evaluation!.totalCount).toBe(0);
  });
});
