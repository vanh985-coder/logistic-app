import * as XLSX from 'xlsx';
import { MatchGroupDto } from '@logix/shared';
import {
  PackingResult,
  PackageMetadata,
  PackingStrategy,
  ContainerDimension,
  PackedPlacement,
} from './types';

const STRATEGY_TITLES: Record<PackingStrategy, { vi: string; fileSuffix: string }> = {
  MAX_VOLUME: { vi: 'Tối ưu thể tích (Max Volume)', fileSuffix: 'MaxVolume' },
  CONSIGNEE_GROUPED: { vi: 'Gom theo chủ hàng (Consignee Grouped)', fileSuffix: 'ConsigneeGrouped' },
  LIFO_PRIORITY: { vi: 'Ưu tiên thứ tự dỡ (LIFO Priority)', fileSuffix: 'LifoPriority' },
};

export function computeUnloadingSequence(
  placements: PackedPlacement[],
  packagesMap: Map<string, PackageMetadata>,
): number[] {
  const indices = placements.map((_, idx) => idx);
  indices.sort((idxA, idxB) => {
    const pA = placements[idxA];
    const pB = placements[idxB];
    const metaA = packagesMap.get(pA.packageId);
    const metaB = packagesMap.get(pB.packageId);

    // 1. Drop destination ascending (earlier drop stops unloaded first)
    const dropA = metaA?.dropOrder ?? 1;
    const dropB = metaB?.dropOrder ?? 1;
    if (dropA !== dropB) return dropA - dropB;

    // 2. Proximity to container door (+X axis). Containers are unloaded from door inwards.
    const frontA = pA.xMm + pA.placedLengthMm;
    const frontB = pB.xMm + pB.placedLengthMm;
    if (Math.abs(frontB - frontA) > 150) {
      return frontB - frontA; // Closer to door unloaded first
    }

    // 3. Stacking height (+Z axis). Top boxes lifted before bottom boxes.
    const topA = pA.zMm + pA.placedHeightMm;
    const topB = pB.zMm + pB.placedHeightMm;
    return topB - topA;
  });
  return indices;
}

export function exportStowagePlanToExcel({
  matchGroup,
  strategy,
  packingResult,
  packagesMap,
  containerDim,
}: {
  matchGroup: MatchGroupDto;
  strategy: PackingStrategy;
  packingResult: PackingResult;
  packagesMap: Map<string, PackageMetadata>;
  containerDim: ContainerDimension;
}) {
  const stratInfo = STRATEGY_TITLES[strategy] || { vi: strategy, fileSuffix: strategy };
  const wb = XLSX.utils.book_new();

  // -------------------------------------------------------------
  // SHEET 1: Sơ đồ xếp hàng (Stowage Plan)
  // -------------------------------------------------------------
  const sheet1Data: any[][] = [];

  // Title & Metadata header
  sheet1Data.push(['BÁO CÁO KẾ HOẠCH XẾP HÀNG CONTAINER 3D (STOWAGE PLAN)']);
  sheet1Data.push(['Mã nhóm ghép:', matchGroup.code]);
  sheet1Data.push(['Tuyến vận chuyển:', matchGroup.lane ? `${matchGroup.lane.origin} -> ${matchGroup.lane.destination} (${matchGroup.lane.code})` : 'N/A']);
  sheet1Data.push(['Loại container:', matchGroup.targetContainerType?.name || '40HC']);
  sheet1Data.push([
    'Kích thước lòng cont (DxRxC):',
    `${containerDim.innerLengthMm} x ${containerDim.innerWidthMm} x ${containerDim.innerHeightMm} mm`,
  ]);
  sheet1Data.push(['Tải trọng tối đa:', `${(containerDim.maxPayloadGram / 1000).toLocaleString('vi-VN')} kg`]);
  sheet1Data.push(['Chiến lược xếp hàng:', stratInfo.vi]);
  sheet1Data.push(['Tỷ lệ lấp đầy thể tích:', `${(packingResult.fillRateBps / 100).toFixed(2)}%`]);
  sheet1Data.push([
    'Tổng khối lượng xếp được:',
    `${(packingResult.totalWeightGrams / 1000).toLocaleString('vi-VN')} kg`,
  ]);
  sheet1Data.push([
    'Trọng tâm dọc cont (CoG X):',
    `${packingResult.centerOfGravity.xPercentage.toFixed(2)}% (${packingResult.centerOfGravity.xMm} mm) - ${packingResult.cogViolation ? 'CẢNH BÁO LỆCH' : 'AN TOÀN HÀNG HẢI'}`,
  ]);
  sheet1Data.push([]); // Empty row

  // Table header
  sheet1Data.push([
    'Thứ tự dỡ',
    'Thứ tự xếp',
    'Mã kiện hàng (SKU)',
    'Mã vận đơn',
    'Chủ hàng (Shipper)',
    'Điểm giao hàng (Destination)',
    'Thứ tự điểm dỡ (Drop)',
    'Dài (mm)',
    'Rộng (mm)',
    'Cao (mm)',
    'Khối lượng (kg)',
    'Thể tích (m³)',
    'Tọa độ X (mm)',
    'Tọa độ Y (mm)',
    'Tọa độ Z (mm)',
    'Hướng xoay (0-5)',
    'Tầng cao',
    'Dễ vỡ',
    'Cấm đè',
    'Trạng thái',
  ]);

  const unloadingSeq = computeUnloadingSequence(packingResult.placedPackages, packagesMap);
  const placedList = unloadingSeq.map((placementIdx, unloadOrder) => {
    const p = packingResult.placedPackages[placementIdx];
    const meta = packagesMap.get(p.packageId);
    return {
      placement: p,
      meta,
      packingOrder: placementIdx + 1,
      unloadingOrder: unloadOrder + 1,
    };
  });

  placedList.forEach((item, unloadIdx) => {
    const p = item.placement;
    const meta = item.meta;
    const volM3 = (p.placedLengthMm * p.placedWidthMm * p.placedHeightMm) / 1e9;

    sheet1Data.push([
      unloadIdx + 1,
      item.packingOrder,
      meta?.packageCode || p.packageId,
      meta?.shipmentTrackingCode || '',
      meta?.companyName || '',
      meta?.deliveryDestination || 'Kho trung tâm',
      meta?.dropOrder ?? 1,
      p.placedLengthMm,
      p.placedWidthMm,
      p.placedHeightMm,
      meta ? (meta.weightGrams / 1000) : 0,
      Number(volM3.toFixed(4)),
      p.xMm,
      p.yMm,
      p.zMm,
      p.rotation,
      p.layerIndex,
      meta?.isFragile ? 'Có' : 'Không',
      meta?.noStack ? 'Cấm đè' : 'Được chồng',
      'ĐÃ XẾP',
    ]);
  });

  // Append unplaced packages if any
  if (packingResult.unplacedPackages && packingResult.unplacedPackages.length > 0) {
    packingResult.unplacedPackages.forEach((u, _uIdx) => {
      const meta = packagesMap.get(u.packageId);
      const volM3 = meta ? (meta.lengthMm * meta.widthMm * meta.heightMm) / 1e9 : 0;

      sheet1Data.push([
        '—',
        '—',
        meta?.packageCode || u.packageId,
        meta?.shipmentTrackingCode || '',
        meta?.companyName || '',
        meta?.deliveryDestination || 'Kho trung tâm',
        meta?.dropOrder ?? '—',
        meta?.lengthMm ?? 0,
        meta?.widthMm ?? 0,
        meta?.heightMm ?? 0,
        meta ? (meta.weightGrams / 1000) : 0,
        Number(volM3.toFixed(4)),
        '—',
        '—',
        '—',
        '—',
        '—',
        meta?.isFragile ? 'Có' : 'Không',
        meta?.noStack ? 'Cấm đè' : 'Được chồng',
        `BỎ LẠI (${u.reason})`,
      ]);
    });
  }

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);

  // Column widths formatting
  ws1['!cols'] = [
    { wch: 12 }, // Thứ tự dỡ
    { wch: 12 }, // Thứ tự xếp
    { wch: 22 }, // Mã kiện
    { wch: 20 }, // Vận đơn
    { wch: 35 }, // Chủ hàng
    { wch: 45 }, // Điểm giao
    { wch: 12 }, // Drop
    { wch: 10 }, // Dài
    { wch: 10 }, // Rộng
    { wch: 10 }, // Cao
    { wch: 14 }, // Khối lượng
    { wch: 14 }, // Thể tích
    { wch: 12 }, // X
    { wch: 12 }, // Y
    { wch: 12 }, // Z
    { wch: 14 }, // Xoay
    { wch: 10 }, // Tầng
    { wch: 10 }, // Dễ vỡ
    { wch: 12 }, // Cấm đè
    { wch: 20 }, // Trạng thái
  ];

  XLSX.utils.book_append_sheet(wb, ws1, 'Kế hoạch xếp hàng');

  // -------------------------------------------------------------
  // SHEET 2: Bảng đánh giá chất lượng (Evaluation)
  // -------------------------------------------------------------
  const sheet2Data: any[][] = [];
  const evalData = packingResult.evaluation;

  sheet2Data.push(['BẢNG ĐÁNH GIÁ CHẤT LƯỢNG 7 TIÊU CHÍ (LOGIX QUALITATIVE EVALUATION)']);
  sheet2Data.push(['Mã nhóm ghép:', matchGroup.code]);
  sheet2Data.push(['Phương án chiến lược:', stratInfo.vi]);
  sheet2Data.push([]);

  // Top row: Placed vs Unplaced
  const totalCount = evalData?.totalCount ?? (packingResult.placedPackages.length + packingResult.unplacedPackages.length);
  const unplacedCount = evalData?.unplacedCount ?? packingResult.unplacedPackages.length;
  const placedCount = totalCount - unplacedCount;

  sheet2Data.push(['KẾT QUẢ XẾP KIỆN TỔNG QUAN']);
  sheet2Data.push(['Tổng số kiện hàng:', totalCount]);
  sheet2Data.push(['Số kiện xếp thành công:', `${placedCount} kiện`]);
  sheet2Data.push([
    'Số kiện bỏ lại (Unplaced):',
    `${unplacedCount} kiện (${((unplacedCount / totalCount) * 100).toFixed(1)}%)`,
  ]);
  sheet2Data.push([
    'Khuyến nghị điều phối:',
    unplacedCount > 0
      ? `Bỏ lại ${unplacedCount} kiện — Cần thuê thêm 01 container phụ hoặc chuyển sang đợt gom sau.`
      : 'Toàn bộ kiện hàng đã được xếp gọn trong 01 container duy nhất.',
  ]);
  sheet2Data.push([]);

  // Criteria Table
  sheet2Data.push([
    'STT',
    'Tiêu chí đánh giá',
    'Xếp loại định tính (5 mức)',
    'Diễn giải kỹ thuật & Ý nghĩa nghiệp vụ',
    'Ghi chú chuyên ngành logistics',
  ]);

  if (evalData?.criteria) {
    const criteriaList = Array.isArray(evalData.criteria)
      ? evalData.criteria
      : Object.values(evalData.criteria);

    criteriaList.forEach((c: any, idx: number) => {
      const isPayload = c.id === 'weightUtilization' || c.key === 'payload';
      const isLifo = c.id === 'lifoCompliance' || c.key === 'lifo';
      const isAccessibility = c.id === 'consigneeAccessibility' || c.key === 'accessibility';
      const note = isPayload
        ? 'Đối với hàng may mặc, điện tử, nội thất cồng kềnh nhẹ, thể tích cont đầy 73% trước khi tải trọng đạt mức tối đa. Mức đánh giá "Trung bình" cho tải trọng là chuẩn mực hợp lý của loại hàng này.'
        : isLifo
        ? 'Đo lường mức độ tuân thủ quy tắc First-In Last-Out dọc theo hành trình các điểm trả hàng, hạn chế tối đa việc phải đảo hàng tại các cảng/kho trung gian.'
        : isAccessibility
        ? 'Đo lường tính liền khối các kiện cùng một chủ hàng. Càng gom gần nhau thì thủ kho CFS càng dễ dỡ và bàn giao nhanh chóng.'
        : 'Đạt chuẩn kiểm định an toàn hàng hải quốc tế.';

      sheet2Data.push([
        idx + 1,
        c.name,
        c.ratingLabel,
        c.description,
        note,
      ]);
    });
  }

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2['!cols'] = [
    { wch: 8 },  // STT
    { wch: 30 }, // Tên tiêu chí
    { wch: 24 }, // Xếp loại định tính
    { wch: 60 }, // Diễn giải
    { wch: 60 }, // Ghi chú
  ];

  XLSX.utils.book_append_sheet(wb, ws2, 'Đánh giá 7 tiêu chí');

  // Trigger browser download
  const fileName = `StowagePlan_${matchGroup.code}_${stratInfo.fileSuffix}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
