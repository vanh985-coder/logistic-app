import { PrismaClient } from '@prisma/client';
import {
  ContainerDimension,
  PackageItem,
  packContainers,
  packMultiStrategies,
  ExtremePointPacker,
} from '@logix/packing';
import { performance } from 'perf_hooks';

const prisma = new PrismaClient();

async function main() {
  console.log('========================================================================================');
  console.log('EVALUATING 3 PACKING STRATEGIES ON REAL DATABASE DATA (MG-DEMO-40HC-01)');
  console.log('========================================================================================\n');

  const matchGroup = await prisma.matchGroup.findUnique({
    where: { code: 'MG-DEMO-40HC-01' },
    include: {
      targetContainerType: true,
      matchGroupShipments: {
        include: {
          company: true,
          shipment: {
            include: {
              packages: true,
            },
          },
        },
      },
    },
  });

  if (!matchGroup) {
    console.error('ERROR: MatchGroup MG-DEMO-40HC-01 not found in database! Please run pnpm seed first.');
    process.exit(1);
  }

  const c = matchGroup.targetContainerType;
  const container: ContainerDimension = {
    innerLengthMm: c.innerLengthMm,
    innerWidthMm: c.innerWidthMm,
    innerHeightMm: c.innerHeightMm,
    maxPayloadGram: Number(c.maxPayloadGram),
  };

  const packages: PackageItem[] = [];
  console.log(`Match Group: ${matchGroup.code} (${matchGroup.matchGroupShipments.length} shipments)`);
  console.log(`Container: ${c.name} (${c.innerLengthMm}x${c.innerWidthMm}x${c.innerHeightMm} mm, Max Payload: ${Number(c.maxPayloadGram) / 1000} kg)\n`);
  console.log(`STOPS & DELIVERIES ASSIGNED:`);
  console.log(`----------------------------------------------------------------------------------------`);

  // Sort match group shipments by dropOrder
  const sortedMgs = [...matchGroup.matchGroupShipments].sort(
    (a, b) => (a.dropOrder ?? 1) - (b.dropOrder ?? 1),
  );

  for (const mgs of sortedMgs) {
    const dropOrder = mgs.dropOrder ?? 1;
    const dest = mgs.deliveryDestination || 'Kho trung tâm';
    console.log(
      `Drop ${dropOrder}: [${mgs.company.name}] -> ${dest} (${mgs.shipment.packages.length} packages)`,
    );

    for (const pkg of mgs.shipment.packages) {
      packages.push({
        id: pkg.id,
        sku: pkg.packageCode,
        name: pkg.packageCode,
        companyId: mgs.companyId,
        lengthMm: pkg.lengthMm,
        widthMm: pkg.widthMm,
        heightMm: pkg.heightMm,
        weightGram: Number(pkg.weightGrams),
        fragile: pkg.isFragile,
        noStack: pkg.noStack,
        rotatable: true,
        dropOrder,
      });
    }
  }

  console.log(`----------------------------------------------------------------------------------------`);
  console.log(`Total packages from DB: ${packages.length}\n`);

  // 1. Benchmarking execution times
  // Warmup
  packContainers(container, packages.slice(0, 10), { strategy: 'MAX_VOLUME' });

  const t0_cg = performance.now();
  const res_cg = packContainers(container, packages, { strategy: 'CONSIGNEE_GROUPED' });
  const time_cg = performance.now() - t0_cg;

  const t0_mv = performance.now();
  const res_mv = packContainers(container, packages, { strategy: 'MAX_VOLUME' });
  const time_mv = performance.now() - t0_mv;

  const t0_lifo = performance.now();
  const res_lifo = packContainers(container, packages, { strategy: 'LIFO_PRIORITY' });
  const time_lifo = performance.now() - t0_lifo;

  const totalTime = time_cg + time_mv + time_lifo;

  console.log(`TIMING RESULTS (Measured on REAL DB data with performance.now()):`);
  console.log(`----------------------------------------------------------------------------------------`);
  console.log(`1. CONSIGNEE_GROUPED:  ${time_cg.toFixed(2).padStart(8)} ms  (${res_cg.placedPackages.length}/${packages.length} kiện)`);
  console.log(`2. MAX_VOLUME:         ${time_mv.toFixed(2).padStart(8)} ms  (${res_mv.placedPackages.length}/${packages.length} kiện)`);
  console.log(`3. LIFO_PRIORITY:      ${time_lifo.toFixed(2).padStart(8)} ms  (${res_lifo.placedPackages.length}/${packages.length} kiện)`);
  console.log(`----------------------------------------------------------------------------------------`);
  console.log(`TOTAL SEQUENTIAL TIME: ${totalTime.toFixed(2).padStart(8)} ms (${(totalTime / 1000).toFixed(3)}s)\n`);

  const eval_cg = res_cg.evaluation!;
  const eval_mv = res_mv.evaluation!;
  const eval_lifo = res_lifo.evaluation!;

  console.log(`========================================================================================================`);
  console.log(`MA TRẬN ĐÁNH GIÁ 7 TIÊU CHÍ x 3 CHIẾN LƯỢC (TRÊN DỮ LIỆU THẬT DATABASE)`);
  console.log(`========================================================================================================`);
  console.log(`Hàng mục / Tiêu chí             | GOM THEO CHỦ HÀNG (CG)     | TỐI ƯU THỂ TÍCH (MV)       | ƯU TIÊN THỨ TỰ DỠ (LIFO)`);
  console.log(`--------------------------------+----------------------------+----------------------------+----------------------------`);
  console.log(
    `Số kiện xếp được                | ${String(eval_cg.placedCount + '/' + eval_cg.totalCount).padEnd(12)} [${eval_cg.unplacedAlert.padEnd(8)}] | ` +
    `${String(eval_mv.placedCount + '/' + eval_mv.totalCount).padEnd(12)} [${eval_mv.unplacedAlert.padEnd(8)}] | ` +
    `${String(eval_lifo.placedCount + '/' + eval_lifo.totalCount).padEnd(12)} [${eval_lifo.unplacedAlert.padEnd(8)}]`,
  );
  console.log(
    `Ghi chú bỏ lại kiện             | ${eval_cg.unplacedCount > 0 ? `Bỏ lại ${eval_cg.unplacedCount} kiện (thêm cont)` : 'Xếp đủ 100% kiện'}   | ` +
    `${eval_mv.unplacedCount > 0 ? `Bỏ lại ${eval_mv.unplacedCount} kiện (thêm cont)` : 'Xếp đủ 100% kiện'}   | ` +
    `${eval_lifo.unplacedCount > 0 ? `Bỏ lại ${eval_lifo.unplacedCount} kiện (thêm cont)` : 'Xếp đủ 100% kiện'}`,
  );
  console.log(`--------------------------------+----------------------------+----------------------------+----------------------------`);
  console.log(
    `1. Không gian (Fill Rate)       | ${eval_cg.criteria.volumeUtilization.rawScore.toFixed(2).padStart(6)}% (${eval_cg.criteria.volumeUtilization.ratingLabel.padEnd(10)})   | ` +
    `${eval_mv.criteria.volumeUtilization.rawScore.toFixed(2).padStart(6)}% (${eval_mv.criteria.volumeUtilization.ratingLabel.padEnd(10)})   | ` +
    `${eval_lifo.criteria.volumeUtilization.rawScore.toFixed(2).padStart(6)}% (${eval_lifo.criteria.volumeUtilization.ratingLabel.padEnd(10)})`,
  );
  console.log(
    `2. Khai thác tải trọng          | ${eval_cg.criteria.weightUtilization.rawScore.toFixed(2).padStart(6)}% (${eval_cg.criteria.weightUtilization.ratingLabel.padEnd(10)})   | ` +
    `${eval_mv.criteria.weightUtilization.rawScore.toFixed(2).padStart(6)}% (${eval_mv.criteria.weightUtilization.ratingLabel.padEnd(10)})   | ` +
    `${eval_lifo.criteria.weightUtilization.rawScore.toFixed(2).padStart(6)}% (${eval_lifo.criteria.weightUtilization.ratingLabel.padEnd(10)})`,
  );
  console.log(
    `3. Trọng tâm (Độ lệch 3 trục)   | ${eval_cg.criteria.cogDeviation.rawScore.toFixed(2).padStart(6)}% (${eval_cg.criteria.cogDeviation.ratingLabel.padEnd(10)})   | ` +
    `${eval_mv.criteria.cogDeviation.rawScore.toFixed(2).padStart(6)}% (${eval_mv.criteria.cogDeviation.ratingLabel.padEnd(10)})   | ` +
    `${eval_lifo.criteria.cogDeviation.rawScore.toFixed(2).padStart(6)}% (${eval_lifo.criteria.cogDeviation.ratingLabel.padEnd(10)})`,
  );
  console.log(
    `4. Ổn định (Stability Score)    | ${eval_cg.criteria.stabilityScore.rawScore.toFixed(2).padStart(6)}% (${eval_cg.criteria.stabilityScore.ratingLabel.padEnd(10)})   | ` +
    `${eval_mv.criteria.stabilityScore.rawScore.toFixed(2).padStart(6)}% (${eval_mv.criteria.stabilityScore.ratingLabel.padEnd(10)})   | ` +
    `${eval_lifo.criteria.stabilityScore.rawScore.toFixed(2).padStart(6)}% (${eval_lifo.criteria.stabilityScore.ratingLabel.padEnd(10)})`,
  );
  console.log(
    `5. Tương thích hàng             | ${eval_cg.criteria.cargoCompatibility.rawScore.toFixed(2).padStart(6)}% (${eval_cg.criteria.cargoCompatibility.ratingLabel.padEnd(10)})   | ` +
    `${eval_mv.criteria.cargoCompatibility.rawScore.toFixed(2).padStart(6)}% (${eval_mv.criteria.cargoCompatibility.ratingLabel.padEnd(10)})   | ` +
    `${eval_lifo.criteria.cargoCompatibility.rawScore.toFixed(2).padStart(6)}% (${eval_lifo.criteria.cargoCompatibility.ratingLabel.padEnd(10)})`,
  );
  console.log(
    `6. Thứ tự dỡ (LIFO)             | ${eval_cg.criteria.lifoCompliance.rawScore.toFixed(2).padStart(6)}% (${eval_cg.criteria.lifoCompliance.ratingLabel.padEnd(10)})   | ` +
    `${eval_mv.criteria.lifoCompliance.rawScore.toFixed(2).padStart(6)}% (${eval_mv.criteria.lifoCompliance.ratingLabel.padEnd(10)})   | ` +
    `${eval_lifo.criteria.lifoCompliance.rawScore.toFixed(2).padStart(6)}% (${eval_lifo.criteria.lifoCompliance.ratingLabel.padEnd(10)})`,
  );
  console.log(
    `7. Khả năng tiếp cận            | ${eval_cg.criteria.consigneeAccessibility.rawScore.toFixed(2).padStart(6)}% (${eval_cg.criteria.consigneeAccessibility.ratingLabel.padEnd(10)})   | ` +
    `${eval_mv.criteria.consigneeAccessibility.rawScore.toFixed(2).padStart(6)}% (${eval_mv.criteria.consigneeAccessibility.ratingLabel.padEnd(10)})   | ` +
    `${eval_lifo.criteria.consigneeAccessibility.rawScore.toFixed(2).padStart(6)}% (${eval_lifo.criteria.consigneeAccessibility.ratingLabel.padEnd(10)})`,
  );
  console.log(`========================================================================================================\n`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
