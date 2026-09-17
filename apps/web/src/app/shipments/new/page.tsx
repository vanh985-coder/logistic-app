'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import {
  PackageType,
  calculateShipmentPricing,
  calcVolumeMm3,
  cbmFromVolumeMm3,
  kgFromWeightGrams,
  parseAndValidateExcelRows,
  PackagePricingInput,
  PricingConfigInput,
} from '@logix/shared';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  FileSpreadsheet,
  Plus,
  Trash2,
  Info,
} from 'lucide-react';

interface Lane {
  id: string;
  code: string;
  name: string;
  origin: string;
  destination: string;
  currentPricingConfig: {
    id: string;
    version: number;
    cbmRate: string;
    weightRateKg: string;
    fixedFee: string;
    standardSurchargeBps: number;
    irregularSurchargeBps: number;
    noStackSurchargeBps: number;
    maxEdgeRatioThreshold: number;
  } | null;
}

interface PackageItem {
  id: string;
  packageCode: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightGrams: number;
  isFragile: boolean;
  noStack: boolean;
  packageType: PackageType;
}

interface ExcelError {
  row: number;
  column: string;
  message: string;
}
export default function NewShipmentPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedLaneId, setSelectedLaneId] = useState<string>('');
  const [packages, setPackages] = useState<PackageItem[]>([
    {
      id: '1',
      packageCode: 'PKG-001',
      lengthMm: 0,
      widthMm: 0,
      heightMm: 0,
      weightGrams: 0,
      isFragile: false,
      noStack: false,
      packageType: PackageType.BOX,
    },
  ]);
  const [excelErrors, setExcelErrors] = useState<ExcelError[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: lanes, isLoading: isLoadingLanes } = useQuery<Lane[]>({
    queryKey: ['lanes', 'active'],
    queryFn: () => fetchApi<Lane[]>('/lanes?activeOnly=true'),
    staleTime: 60000,
  });

  const selectedLane = lanes?.find((l) => l.id === selectedLaneId) ?? null;
  const pricingConfig = selectedLane?.currentPricingConfig ?? null;

  const formatVnd = (val: string | number | bigint) => {
    const num = typeof val === 'bigint' ? Number(val) : typeof val === 'string' ? Number(val) : val;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  const pricingPreview = React.useMemo(() => {
    if (!pricingConfig || packages.length === 0) return null;

    const configInput: PricingConfigInput = {
      cbmRate: BigInt(pricingConfig.cbmRate),
      weightRateKg: BigInt(pricingConfig.weightRateKg),
      fixedFee: BigInt(pricingConfig.fixedFee),
      standardSurchargeBps: pricingConfig.standardSurchargeBps,
      irregularSurchargeBps: pricingConfig.irregularSurchargeBps,
      noStackSurchargeBps: pricingConfig.noStackSurchargeBps,
      maxEdgeRatioThreshold: pricingConfig.maxEdgeRatioThreshold,
    };

    const packageInputs: PackagePricingInput[] = packages.map((p) => ({
      packageCode: p.packageCode,
      lengthMm: p.lengthMm,
      widthMm: p.widthMm,
      heightMm: p.heightMm,
      weightGrams: p.weightGrams,
      isFragile: p.isFragile,
      noStack: p.noStack,
      volumeMm3: calcVolumeMm3(p.lengthMm, p.widthMm, p.heightMm),
    }));

    return calculateShipmentPricing(packageInputs, configInput);
  }, [pricingConfig, packages]);

  const handleAddPackageRow = () => {
    const nextNum = packages.length + 1;
    setPackages([
      ...packages,
      {
        id: String(Date.now()),
        packageCode: `PKG-${String(nextNum).padStart(3, '0')}`,
        lengthMm: 0,
        widthMm: 0,
        heightMm: 0,
        weightGrams: 0,
        isFragile: false,
        noStack: false,
        packageType: PackageType.BOX,
      },
    ]);
  };

  const handleProceedToStep3 = () => {
    setSubmitError(null);
    for (const p of packages) {
      if (p.lengthMm <= 0 || p.widthMm <= 0 || p.heightMm <= 0 || p.weightGrams <= 0) {
        setSubmitError(`Kiện "${p.packageCode}" chưa nhập đầy đủ kích thước hoặc khối lượng (phải lớn hơn 0).`);
        return;
      }
    }
    setCurrentStep(3);
  };

  const handleRemovePackageRow = (id: string) => {
    if (packages.length <= 1) return;
    setPackages(packages.filter((p) => p.id !== id));
  };

  const handleUpdatePackage = (id: string, field: keyof PackageItem, value: any) => {
    setPackages(
      packages.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  };
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelErrors([]);
    setIsUploading(true);

    try {
      const xlsx = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = xlsx.read(buffer, { type: 'array' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rawRows: any[][] = xlsx.utils.sheet_to_json(firstSheet, {
        header: 1,
        defval: '',
        blankrows: false,
      });

      // Use shared validator so logic is identical between frontend preview & backend
      const result = parseAndValidateExcelRows(rawRows);

      if (result.errors.length > 0) {
        setExcelErrors(result.errors);
      }

      if (result.packages.length > 0) {
        setPackages(
          result.packages.map((p, idx) => ({
            id: String(Date.now() + idx),
            packageCode: p.packageCode,
            lengthMm: p.lengthMm,
            widthMm: p.widthMm,
            heightMm: p.heightMm,
            weightGrams: p.weightGrams,
            isFragile: p.isFragile,
            noStack: p.noStack,
            packageType: p.packageType,
          })),
        );
      }
    } catch {
      setExcelErrors([
        {
          row: 0,
          column: 'FILE',
          message: 'Không thể đọc file Excel. Vui lòng kiểm tra định dạng',
        },
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    const xlsx = await import('xlsx');
    const wsData = [
      ['Mã kiện', 'Dài (mm)', 'Rộng (mm)', 'Cao (mm)', 'Trọng lượng (g)', 'Dễ vỡ (có/không)', 'Không chồng (có/không)', 'Loại kiện (BOX/PALLET/CRATE)'],
      ['PKG-001', 600, 400, 300, 10000, 'không', 'không', 'BOX'],
      ['PKG-002', 1200, 800, 900, 35000, 'có', 'không', 'PALLET'],
      ['PKG-003', 500, 500, 500, 12000, 'không', 'có', 'BOX'],
    ];
    const ws = xlsx.utils.aoa_to_sheet(wsData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Mau_Kien_Hang');
    xlsx.writeFile(wb, 'mau_danh_sach_kien_hang.xlsx');
  };

  const handleCreateShipment = async (autoSubmit: boolean) => {
    if (!selectedLaneId) {
      setSubmitError('Vui lòng chọn tuyến vận chuyển');
      return;
    }
    if (packages.length === 0) {
      setSubmitError('Vui lòng nhập ít nhất 1 kiện hàng');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const shipment = await fetchApi<{ id: string; trackingCode: string }>('/shipments', {
        method: 'POST',
        body: JSON.stringify({ laneId: selectedLaneId }),
      });

      // Batch insert packages in a single request instead of N+1 requests
      await fetchApi(`/shipments/${shipment.id}/packages/batch`, {
        method: 'POST',
        body: JSON.stringify({
          packages: packages.map((p) => ({
            packageCode: p.packageCode,
            lengthMm: p.lengthMm,
            widthMm: p.widthMm,
            heightMm: p.heightMm,
            weightGrams: p.weightGrams,
            isFragile: p.isFragile,
            noStack: p.noStack,
            packageType: p.packageType,
          })),
        }),
      });

      if (autoSubmit) {
        await fetchApi(`/shipments/${shipment.id}/submit`, {
          method: 'POST',
        });
      }

      router.push(`/shipments/${shipment.id}`);
    } catch (err: any) {
      setSubmitError(err.message || 'Lỗi khi tạo lô hàng');
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
          <Link href="/shipments" className="hover:text-blue-400 transition">
            Danh sách Lô hàng
          </Link>
          <span>/</span>
          <span className="text-white">Tạo mới</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Tạo Lô Hàng & Báo Giá Vận Tải
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Quy trình 4 bước: Chọn tuyến → Đóng gói kiện hàng → Báo giá tự động Hg → Xác nhận
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2 border-b border-slate-800 pb-4">
        {[
          { step: 1, title: '1. Tuyến Đường' },
          { step: 2, title: '2. Kiện Hàng' },
          { step: 3, title: '3. Báo Giá & Phụ Phí' },
          { step: 4, title: '4. Xác Nhận' },
        ].map((s) => (
          <button
            key={s.step}
            onClick={() => {
              if (s.step < currentStep || (s.step === 2 && selectedLaneId) || (s.step === 3 && selectedLaneId && packages.length > 0)) {
                setCurrentStep(s.step);
              }
            }}
            className={`text-left py-2 px-3 rounded-lg text-xs font-semibold transition ${
              currentStep === s.step
                ? 'bg-blue-600 text-white shadow-sm'
                : currentStep > s.step
                ? 'bg-slate-900 text-blue-400 border border-blue-900/60'
                : 'bg-slate-900 text-slate-500'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {currentStep === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white">Bước 1: Chọn Tuyến Vận Chuyển</h2>
            <p className="text-xs text-slate-400 mt-1">
              Giá cước CBM, trọng lượng và phụ phí hình học được niêm yết theo từng tuyến
            </p>
          </div>

          {isLoadingLanes ? (
            <div className="p-8 text-center text-slate-400 text-sm">Đang tải danh sách tuyến...</div>
          ) : !lanes?.length ? (
            <div className="p-8 text-center text-slate-400 text-sm">Không có tuyến nào đang hoạt động</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lanes.map((lane) => {
                const config = lane.currentPricingConfig;
                const isSelected = selectedLaneId === lane.id;
                return (
                  <div
                    key={lane.id}
                    onClick={() => setSelectedLaneId(lane.id)}
                    className={`p-5 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-950/40 border-blue-500 shadow-lg shadow-blue-500/10'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
                          {lane.code}
                        </span>
                        <h3 className="text-base font-bold text-white mt-2">{lane.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {lane.origin} → {lane.destination}
                        </p>
                      </div>
                      <div className="h-5 w-5 rounded-full border border-slate-600 flex items-center justify-center">
                        {isSelected && <div className="h-3 w-3 rounded-full bg-blue-500" />}
                      </div>
                    </div>

                    {config && (
                      <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-[10px] text-slate-400">Giá CBM</div>
                          <div className="font-mono font-semibold text-white mt-0.5">
                            {formatVnd(config.cbmRate)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Giá 1 kg</div>
                          <div className="font-mono font-semibold text-white mt-0.5">
                            {formatVnd(config.weightRateKg)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Phí cố định</div>
                          <div className="font-mono font-semibold text-white mt-0.5">
                            {formatVnd(config.fixedFee)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setCurrentStep(2)}
              disabled={!selectedLaneId}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition"
            >
              Tiếp tục <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Bước 2: Nhập Danh Sách Kiện Hàng</h2>
              <p className="text-xs text-slate-400 mt-1">
                Nhập kích thước (mm), khối lượng (g) và các cờ hình học xếp dỡ
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium transition"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                Tải file mẫu Excel
              </button>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer transition">
                <UploadCloud className="h-3.5 w-3.5" />
                {isUploading ? 'Đang đọc...' : 'Tải lên Excel'}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleExcelUpload}
                />
              </label>
            </div>
          </div>

          {excelErrors.length > 0 && (
            <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-200 space-y-2">
              <div className="font-bold flex items-center gap-2 text-red-300">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                Phát hiện {excelErrors.length} lỗi trong file Excel tải lên:
              </div>
              <ul className="list-disc list-inside space-y-1 text-red-300/90 pl-1">
                {excelErrors.slice(0, 5).map((err, idx) => (
                  <li key={idx}>
                    Dòng {err.row} ({err.column}): {err.message}
                  </li>
                ))}
                {excelErrors.length > 5 && (
                  <li>... và {excelErrors.length - 5} lỗi khác</li>
                )}
              </ul>
            </div>
          )}

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="px-3 py-3">Mã Kiện</th>
                    <th className="px-3 py-3">Dài (mm)</th>
                    <th className="px-3 py-3">Rộng (mm)</th>
                    <th className="px-3 py-3">Cao (mm)</th>
                    <th className="px-3 py-3">Khối Lượng (g)</th>
                    <th className="px-3 py-3 text-center">Dễ Vỡ (1.15)</th>
                    <th className="px-3 py-3 text-center">Không Chồng (1.30)</th>
                    <th className="px-3 py-3">Loại Kiện</th>
                    <th className="px-3 py-3 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {packages.map((pkg) => (
                    <tr key={pkg.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={pkg.packageCode}
                          onChange={(e) => handleUpdatePackage(pkg.id, 'packageCode', e.target.value)}
                          className="w-24 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={pkg.lengthMm === 0 ? '' : pkg.lengthMm}
                          placeholder="0"
                          onChange={(e) => handleUpdatePackage(pkg.id, 'lengthMm', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-20 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={pkg.widthMm === 0 ? '' : pkg.widthMm}
                          placeholder="0"
                          onChange={(e) => handleUpdatePackage(pkg.id, 'widthMm', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-20 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={pkg.heightMm === 0 ? '' : pkg.heightMm}
                          placeholder="0"
                          onChange={(e) => handleUpdatePackage(pkg.id, 'heightMm', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-20 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={pkg.weightGrams === 0 ? '' : pkg.weightGrams}
                          placeholder="0"
                          onChange={(e) => handleUpdatePackage(pkg.id, 'weightGrams', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-24 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={pkg.isFragile}
                          onChange={(e) => handleUpdatePackage(pkg.id, 'isFragile', e.target.checked)}
                          className="h-4 w-4 rounded bg-slate-800 border-slate-700 text-blue-600"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={pkg.noStack}
                          onChange={(e) => handleUpdatePackage(pkg.id, 'noStack', e.target.checked)}
                          className="h-4 w-4 rounded bg-slate-800 border-slate-700 text-amber-600"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={pkg.packageType}
                          onChange={(e) => handleUpdatePackage(pkg.id, 'packageType', e.target.value as PackageType)}
                          className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white text-xs"
                        >
                          <option value={PackageType.BOX}>BOX</option>
                          <option value={PackageType.PALLET}>PALLET</option>
                          <option value={PackageType.CRATE}>CRATE</option>
                          <option value={PackageType.OTHER}>OTHER</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleRemovePackageRow(pkg.id)}
                          disabled={packages.length <= 1}
                          className="text-slate-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-950/50 border-t border-slate-800 flex justify-between items-center text-xs">
              <button
                onClick={handleAddPackageRow}
                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-semibold transition"
              >
                <Plus className="h-4 w-4" /> Thêm kiện hàng
              </button>
              <div className="text-slate-400">
                Tổng cộng: <span className="font-bold text-white">{packages.length}</span> kiện
              </div>
            </div>
          </div>

          {submitError && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-200">
              {submitError}
            </div>
          )}

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition"
            >
              <ArrowLeft className="h-4 w-4" /> Quay lại Bước 1
            </button>
            <button
              onClick={handleProceedToStep3}
              disabled={packages.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm transition"
            >
              Xem Báo Giá Trực Tiếp <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {currentStep === 3 && pricingPreview && pricingConfig && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white">Bước 3: Xem Trước Báo Giá & Phụ Phí Hình Học</h2>
            <p className="text-xs text-slate-400 mt-1">
              Phép tính 100% số nguyên VNĐ theo công thức P_total = max(V * Pv, W * Pw) * Hg + P_fixed
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                1. Tính Cước Theo Thể Tích
              </div>
              <div className="text-2xl font-mono font-bold text-white">
                {formatVnd(pricingPreview.baseVolumeAmount)}
              </div>
              <div className="text-xs text-slate-400 font-mono">
                {cbmFromVolumeMm3(pricingPreview.totalVolumeMm3)} m³ × {formatVnd(pricingConfig.cbmRate)}/m³
              </div>
              {pricingPreview.chargeableBasis === 'VOLUME' && (
                <div className="mt-2 inline-block px-2.5 py-1 rounded bg-sky-950 border border-sky-800 text-sky-300 text-xs font-bold">
                  ✓ Thể tích lớn hơn (Áp dụng)
                </div>
              )}
            </div>

            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                2. Tính Cước Theo Trọng Lượng
              </div>
              <div className="text-2xl font-mono font-bold text-white">
                {formatVnd(pricingPreview.baseWeightAmount)}
              </div>
              <div className="text-xs text-slate-400 font-mono">
                {kgFromWeightGrams(pricingPreview.totalWeightGrams)} kg × {formatVnd(pricingConfig.weightRateKg)}/kg
              </div>
              {pricingPreview.chargeableBasis === 'WEIGHT' && (
                <div className="mt-2 inline-block px-2.5 py-1 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-bold">
                  ✓ Trọng lượng lớn hơn (Áp dụng)
                </div>
              )}
            </div>

            <div className="p-5 rounded-xl bg-blue-950/30 border border-blue-800/80 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                3. Tổng Cước Thanh Toán
              </div>
              <div className="text-3xl font-mono font-black text-emerald-400">
                {formatVnd(pricingPreview.totalAmount)}
              </div>
              <div className="text-xs text-slate-300">
                Đã bao gồm phụ phí hình học và phí cố định
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-400" />
              Chi Tiết Phụ Phí Hình Học & Xếp Dỡ (Hệ số Hg)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div
                className={`p-3.5 rounded-lg border transition ${
                  pricingPreview.hgFactorBps === pricingConfig.standardSurchargeBps
                    ? 'bg-blue-950/60 border-blue-600 text-white'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-bold">Mức 1: Tiêu Chuẩn (1.00)</div>
                <div className="text-[11px] mt-1">Kiện hộp chữ nhật chuẩn, có thể xếp chồng bình thường</div>
              </div>

              <div
                className={`p-3.5 rounded-lg border transition ${
                  pricingPreview.hgFactorBps === pricingConfig.irregularSurchargeBps
                    ? 'bg-amber-950/60 border-amber-600 text-white'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-bold">Mức 2: Dễ vỡ / Tỉ lệ lệch (1.15)</div>
                <div className="text-[11px] mt-1">Kiện cờ dễ vỡ hoặc tỉ lệ cạnh max/min &gt; {pricingConfig.maxEdgeRatioThreshold}</div>
              </div>

              <div
                className={`p-3.5 rounded-lg border transition ${
                  pricingPreview.hgFactorBps === pricingConfig.noStackSurchargeBps
                    ? 'bg-red-950/60 border-red-600 text-white'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-bold">Mức 3: Cấm xếp chồng (1.30)</div>
                <div className="text-[11px] mt-1">Chiếm trọn cột không gian container theo phương thẳng đứng</div>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-1">
              <div>
                Hệ số Hg áp dụng cho toàn lô: <span className="font-bold text-white font-mono">{(pricingPreview.hgFactorBps / 10000).toFixed(2)}</span> ({pricingPreview.hgReason})
              </div>
              <div>
                Tiền phụ phí hình học: <span className="font-bold text-amber-400 font-mono">+{formatVnd(pricingPreview.surchargeFee)}</span>
              </div>
              <div>
                Phí xử lý cố định: <span className="font-bold text-white font-mono">+{formatVnd(pricingPreview.fixedFee)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition"
            >
              <ArrowLeft className="h-4 w-4" /> Sửa Kiện Hàng
            </button>
            <button
              onClick={() => setCurrentStep(4)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition"
            >
              Tiếp tục Xác Nhận <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {currentStep === 4 && pricingPreview && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white">Bước 4: Xác Nhận & Tạo Lô Hàng</h2>
            <p className="text-xs text-slate-400 mt-1">
              Kiểm tra thông tin lần cuối trước khi lưu vào hệ thống
            </p>
          </div>

          {submitError && (
            <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-200">
              {submitError}
            </div>
          )}

          <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400">Tuyến đường:</span>
                <div className="font-bold text-white mt-0.5">{selectedLane?.name}</div>
              </div>
              <div>
                <span className="text-slate-400">Tổng số kiện:</span>
                <div className="font-bold text-white mt-0.5">{packages.length} kiện</div>
              </div>
              <div>
                <span className="text-slate-400">Tổng thể tích:</span>
                <div className="font-bold text-white mt-0.5">{cbmFromVolumeMm3(pricingPreview.totalVolumeMm3)} m³</div>
              </div>
              <div>
                <span className="text-slate-400">Tổng khối lượng:</span>
                <div className="font-bold text-white mt-0.5">{kgFromWeightGrams(pricingPreview.totalWeightGrams)} kg</div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">Tổng chi phí vận tải ước tính:</div>
                <div className="text-2xl font-mono font-black text-emerald-400 mt-0.5">
                  {formatVnd(pricingPreview.totalAmount)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleCreateShipment(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer"
                >
                  Lưu Bản Nháp
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleCreateShipment(true)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-blue-500/20 transition cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isSubmitting ? 'Đang khởi tạo...' : 'Xác Nhận & Gửi Lô Hàng'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
