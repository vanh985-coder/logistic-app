'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import {
  PackageType,
  calculateShipmentPricing,
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
  MapPin,
} from 'lucide-react';
import { Button, Stepper, Card } from '@/components/ui';

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

  // Auto-select first lane if available and none selected
  React.useEffect(() => {
    if (lanes && lanes.length > 0 && !selectedLaneId) {
      setSelectedLaneId(lanes[0].id);
    }
  }, [lanes, selectedLaneId]);

  const isStep2Valid = React.useMemo(() => {
    if (packages.length === 0) return false;
    return packages.every(
      (p) => p.lengthMm > 0 && p.widthMm > 0 && p.heightMm > 0 && p.weightGrams > 0
    );
  }, [packages]);

  const formatVnd = (val: string | number | bigint) => {
    const num = typeof val === 'bigint' ? Number(val) : typeof val === 'string' ? Number(val) : val;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  const pricingPreview = React.useMemo(() => {
    if (!pricingConfig || !isStep2Valid) return null;

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
      packageType: p.packageType,
    }));

    try {
      return calculateShipmentPricing(packageInputs, configInput);
    } catch {
      return null;
    }
  }, [pricingConfig, packages, isStep2Valid]);

  const handleAddPackageRow = () => {
    const newId = String(Date.now());
    const nextCode = `PKG-${String(packages.length + 1).padStart(3, '0')}`;
    setPackages([
      ...packages,
      {
        id: newId,
        packageCode: nextCode,
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

  const handleRemovePackageRow = (id: string) => {
    if (packages.length <= 1) return;
    setPackages(packages.filter((p) => p.id !== id));
  };

  const handleUpdatePackage = (
    id: string,
    field: keyof PackageItem,
    value: any
  ) => {
    setPackages(
      packages.map((p) => {
        if (p.id !== id) return p;
        return { ...p, [field]: value };
      })
    );
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      'packageCode,lengthMm,widthMm,heightMm,weightGrams,isFragile,noStack,packageType\n' +
      'PKG-001,1200,800,1000,150000,false,false,BOX\n' +
      'PKG-002,600,400,500,45000,true,false,BOX\n' +
      'PKG-003,1100,1100,1200,300000,false,true,PALLET\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'mau_danh_sach_kien_hang_logix3d.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setExcelErrors([]);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        setExcelErrors([{ row: 1, column: 'File', message: 'File không có dữ liệu kiện hàng' }]);
        setIsUploading(false);
        return;
      }

      const rawRows: any[][] = lines.map((line) => line.split(',').map((v) => v.trim()));

      const result = parseAndValidateExcelRows(rawRows);
      if (!result.success) {
        setExcelErrors(
          result.errors.map((err) => ({
            row: err.row,
            column: err.column,
            message: err.message,
          }))
        );
      } else {
        const newPackages: PackageItem[] = result.packages.map((r, idx) => ({
          id: String(Date.now() + idx),
          packageCode: r.packageCode,
          lengthMm: r.lengthMm,
          widthMm: r.widthMm,
          heightMm: r.heightMm,
          weightGrams: r.weightGrams,
          isFragile: r.isFragile,
          noStack: r.noStack,
          packageType: r.packageType as PackageType,
        }));
        setPackages(newPackages);
      }
    } catch (err: any) {
      setExcelErrors([{ row: 0, column: 'File', message: err.message || 'Lỗi đọc file' }]);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleProceedToStep3 = () => {
    if (!isStep2Valid) {
      setSubmitError(
        'Vui lòng nhập kích thước (dài, rộng, cao > 0 mm) và khối lượng (> 0 g) cho tất cả các kiện để tiếp tục',
      );
      return;
    }
    setSubmitError(null);
    setCurrentStep(3);
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
    <div className="max-w-5xl mx-auto space-y-6 pb-12 font-sans">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-text-secondary mb-2">
          <Link href="/shipments" className="hover:text-primary transition">
            Danh sách Lô hàng
          </Link>
          <span>/</span>
          <span className="text-title font-medium">Tạo mới</span>
        </div>
        <h1 className="text-2xl font-bold text-title tracking-tight">
          Tạo Lô Hàng LCL & Báo Giá Vận Tải
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          Quy trình 4 bước: Chọn tuyến → Đóng gói kiện hàng → Báo giá tự động Hg → Xác nhận gửi
        </p>
      </div>

      {/* Stepper Header */}
      <Card className="p-4 bg-surface-card border-border-subtle shadow-sm">
        <Stepper
          currentStep={currentStep}
          totalSteps={4}
          stepTitles={['Tuyến Vận Chuyển', 'Danh Sách Kiện Hàng', 'Báo Giá & Phụ Phí Hg', 'Xác Nhận Đơn Hàng']}
        />
      </Card>

      {/* Step 1: Lane Selection */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-title">Bước 1: Chọn Tuyến Vận Chuyển</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Giá cước CBM, trọng lượng và phụ phí hình học được niêm yết theo từng tuyến
            </p>
          </div>

          {isLoadingLanes ? (
            <div className="p-8 text-center text-text-secondary text-sm">Đang tải danh sách tuyến...</div>
          ) : !lanes?.length ? (
            <div className="p-8 text-center text-text-secondary text-sm">Không có tuyến nào đang hoạt động</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lanes.map((lane) => {
                const config = lane.currentPricingConfig;
                const isSelected = selectedLaneId === lane.id;
                return (
                  <div
                    key={lane.id}
                    onClick={() => setSelectedLaneId(lane.id)}
                    className={`p-5 rounded-2xl border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-primary-tint border-primary shadow-sm ring-2 ring-primary/20'
                        : 'bg-surface-card border-border-subtle hover:border-slate-300 hover:bg-surface-app'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono-numeric text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-primary border border-blue-200">
                          {lane.code}
                        </span>
                        <h3 className="text-base font-bold text-title mt-2">{lane.name}</h3>
                        <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-text-muted" />
                          {lane.origin} → {lane.destination}
                        </p>
                      </div>
                      <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${isSelected ? 'border-primary' : 'border-border-input'}`}>
                        {isSelected && <div className="h-3 w-3 rounded-full bg-primary" />}
                      </div>
                    </div>

                    {config && (
                      <div className="mt-4 pt-3 border-t border-border-subtle grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-[10px] text-text-secondary">Giá CBM</div>
                          <div className="font-mono-numeric font-bold text-title mt-0.5">
                            {formatVnd(config.cbmRate)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-text-secondary">Giá 1 kg</div>
                          <div className="font-mono-numeric font-bold text-title mt-0.5">
                            {formatVnd(config.weightRateKg)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-text-secondary">Phí cố định</div>
                          <div className="font-mono-numeric font-bold text-title mt-0.5">
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

          {/* Desktop in-flow button */}
          <div className="flex justify-end pt-4">
            <Button
              variant="primary"
              size="md"
              onClick={() => setCurrentStep(2)}
              disabled={!selectedLaneId}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Tiếp tục sang Bước 2
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Packages List */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-title">Bước 2: Nhập Danh Sách Kiện Hàng</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Nhập kích thước (mm), khối lượng (g) và các cờ hình học xếp dỡ
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                leftIcon={<FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />}
              >
                Tải file mẫu Excel
              </Button>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer transition shadow-sm">
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
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 space-y-2">
              <div className="font-bold flex items-center gap-2 text-rose-800">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                Phát hiện {excelErrors.length} lỗi trong file Excel tải lên:
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1">
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

          <Card className="overflow-hidden bg-surface-card border-border-subtle shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-app text-[11px] uppercase tracking-wider text-text-secondary border-b border-border-subtle font-semibold">
                  <tr>
                    <th className="px-3 py-3">Mã Kiện</th>
                    <th className="px-3 py-3">Dài (mm)</th>
                    <th className="px-3 py-3">Rộng (mm)</th>
                    <th className="px-3 py-3">Cao (mm)</th>
                    <th className="px-3 py-3">Khối Lượng (g)</th>
                    <th className="px-3 py-3 text-center">Dễ Vỡ (1.15)</th>
                    <th className="px-3 py-3 text-center">Cấm Chồng (1.30)</th>
                    <th className="px-3 py-3">Loại Kiện</th>
                    <th className="px-3 py-3 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-border-subtle">
                  {packages.map((pkg) => (
                    <tr key={pkg.id} className="hover:bg-surface-app transition-colors">
                      <td className="px-3 py-2.5 align-top">
                        <input
                          type="text"
                          value={pkg.packageCode}
                          onChange={(e) => handleUpdatePackage(pkg.id, 'packageCode', e.target.value)}
                          className="w-24 px-2 py-1.5 rounded-lg bg-surface-card border border-border-input text-title font-mono-numeric text-xs focus:border-primary focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <input
                          type="number"
                          value={pkg.lengthMm === 0 ? '' : pkg.lengthMm}
                          placeholder="0"
                          onChange={(e) => handleUpdatePackage(pkg.id, 'lengthMm', e.target.value === '' ? 0 : Number(e.target.value))}
                          className={`w-20 px-2 py-1.5 rounded-lg border text-title font-mono-numeric text-xs text-right focus:outline-none transition ${
                            pkg.lengthMm <= 0
                              ? 'border-rose-400 bg-rose-50/50 focus:border-rose-500'
                              : 'bg-surface-card border-border-input focus:border-primary'
                          }`}
                        />
                        {pkg.lengthMm <= 0 && (
                          <div className="text-[10px] text-rose-600 font-medium text-right mt-0.5 whitespace-nowrap">
                            Phải &gt; 0
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <input
                          type="number"
                          value={pkg.widthMm === 0 ? '' : pkg.widthMm}
                          placeholder="0"
                          onChange={(e) => handleUpdatePackage(pkg.id, 'widthMm', e.target.value === '' ? 0 : Number(e.target.value))}
                          className={`w-20 px-2 py-1.5 rounded-lg border text-title font-mono-numeric text-xs text-right focus:outline-none transition ${
                            pkg.widthMm <= 0
                              ? 'border-rose-400 bg-rose-50/50 focus:border-rose-500'
                              : 'bg-surface-card border-border-input focus:border-primary'
                          }`}
                        />
                        {pkg.widthMm <= 0 && (
                          <div className="text-[10px] text-rose-600 font-medium text-right mt-0.5 whitespace-nowrap">
                            Phải &gt; 0
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <input
                          type="number"
                          value={pkg.heightMm === 0 ? '' : pkg.heightMm}
                          placeholder="0"
                          onChange={(e) => handleUpdatePackage(pkg.id, 'heightMm', e.target.value === '' ? 0 : Number(e.target.value))}
                          className={`w-20 px-2 py-1.5 rounded-lg border text-title font-mono-numeric text-xs text-right focus:outline-none transition ${
                            pkg.heightMm <= 0
                              ? 'border-rose-400 bg-rose-50/50 focus:border-rose-500'
                              : 'bg-surface-card border-border-input focus:border-primary'
                          }`}
                        />
                        {pkg.heightMm <= 0 && (
                          <div className="text-[10px] text-rose-600 font-medium text-right mt-0.5 whitespace-nowrap">
                            Phải &gt; 0
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <input
                          type="number"
                          value={pkg.weightGrams === 0 ? '' : pkg.weightGrams}
                          placeholder="0"
                          onChange={(e) => handleUpdatePackage(pkg.id, 'weightGrams', e.target.value === '' ? 0 : Number(e.target.value))}
                          className={`w-24 px-2 py-1.5 rounded-lg border text-title font-mono-numeric text-xs text-right focus:outline-none transition ${
                            pkg.weightGrams <= 0
                              ? 'border-rose-400 bg-rose-50/50 focus:border-rose-500'
                              : 'bg-surface-card border-border-input focus:border-primary'
                          }`}
                        />
                        {pkg.weightGrams <= 0 && (
                          <div className="text-[10px] text-rose-600 font-medium text-right mt-0.5 whitespace-nowrap">
                            Phải &gt; 0
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center align-top">
                        <input
                          type="checkbox"
                          checked={pkg.isFragile}
                          onChange={(e) => handleUpdatePackage(pkg.id, 'isFragile', e.target.checked)}
                          className="h-4 w-4 mt-2 rounded border-border-input text-primary focus:ring-primary/20"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center align-top">
                        <input
                          type="checkbox"
                          checked={pkg.noStack}
                          onChange={(e) => handleUpdatePackage(pkg.id, 'noStack', e.target.checked)}
                          className="h-4 w-4 mt-2 rounded border-border-input text-amber-600 focus:ring-amber-500/20"
                        />
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <select
                          value={pkg.packageType}
                          onChange={(e) => handleUpdatePackage(pkg.id, 'packageType', e.target.value as PackageType)}
                          className="px-2 py-1.5 rounded-lg bg-surface-card border border-border-input text-title text-xs focus:border-primary focus:outline-none"
                        >
                          <option value={PackageType.BOX}>BOX</option>
                          <option value={PackageType.PALLET}>PALLET</option>
                          <option value={PackageType.CRATE}>CRATE</option>
                          <option value={PackageType.OTHER}>OTHER</option>
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-center align-top">
                        <button
                          onClick={() => handleRemovePackageRow(pkg.id)}
                          disabled={packages.length <= 1}
                          className="mt-1 text-text-muted hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3.5 bg-surface-app border-t border-border-subtle flex justify-between items-center text-xs">
              <button
                onClick={handleAddPackageRow}
                className="inline-flex items-center gap-1.5 text-primary hover:text-primary-hover font-semibold transition cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Thêm kiện hàng
              </button>
              <div className="text-text-secondary">
                Tổng cộng: <span className="font-bold text-title font-mono-numeric">{packages.length}</span> kiện
              </div>
            </div>
          </Card>

          {submitError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {submitError}
            </div>
          )}

          {!isStep2Valid && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                Vui lòng điền đầy đủ kích thước (dài, rộng, cao &gt; 0 mm) và khối lượng (&gt; 0 g) cho tất cả các kiện để tiếp tục xem báo giá.
              </span>
            </div>
          )}

          {/* Desktop in-flow buttons */}
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              size="md"
              onClick={() => setCurrentStep(1)}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Quay lại Bước 1
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleProceedToStep3}
              disabled={!isStep2Valid}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Xem Báo Giá Trực Tiếp
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Pricing Preview & Hg Surcharges */}
      {currentStep === 3 && pricingPreview && pricingConfig && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-title">Bước 3: Xem Trước Báo Giá & Phụ Phí Hình Học Hg</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Công thức chuẩn hóa: <span className="font-mono-numeric font-semibold">P_total = max(V * Pv, W * Pw) * Hg + P_fixed</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 bg-surface-card border-border-subtle space-y-2 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                1. Tính Theo Thể Tích
              </div>
              <div className="text-2xl font-mono-numeric font-bold text-title">
                {formatVnd(pricingPreview.baseVolumeAmount)}
              </div>
              <div className="text-xs text-text-secondary font-mono-numeric">
                {cbmFromVolumeMm3(pricingPreview.totalVolumeMm3)} m³ × {formatVnd(pricingConfig.cbmRate)}/m³
              </div>
              {pricingPreview.chargeableBasis === 'VOLUME' && (
                <div className="mt-2 inline-block px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-bold">
                  ✓ Thể tích lớn hơn (Áp dụng)
                </div>
              )}
            </Card>

            <Card className="p-5 bg-surface-card border-border-subtle space-y-2 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                2. Tính Theo Khối Lượng
              </div>
              <div className="text-2xl font-mono-numeric font-bold text-title">
                {formatVnd(pricingPreview.baseWeightAmount)}
              </div>
              <div className="text-xs text-text-secondary font-mono-numeric">
                {kgFromWeightGrams(pricingPreview.totalWeightGrams)} kg × {formatVnd(pricingConfig.weightRateKg)}/kg
              </div>
              {pricingPreview.chargeableBasis === 'WEIGHT' && (
                <div className="mt-2 inline-block px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                  ✓ Trọng lượng lớn hơn (Áp dụng)
                </div>
              )}
            </Card>

            <Card className="p-5 bg-primary-tint border-blue-200 space-y-2 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                3. Tổng Cước Ước Tính
              </div>
              <div className="text-3xl font-mono-numeric font-black text-emerald-600">
                {formatVnd(pricingPreview.totalAmount)}
              </div>
              <div className="text-xs text-text-secondary">
                Đã bao gồm phụ phí hình học và phí xử lý cố định
              </div>
            </Card>
          </div>

          <Card className="p-5 bg-surface-card border-border-subtle shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-title flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              Chi Tiết Phụ Phí Hình Học & Xếp Dỡ (Hệ số Hg)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div
                className={`p-3.5 rounded-xl border transition ${
                  pricingPreview.hgFactorBps === pricingConfig.standardSurchargeBps
                    ? 'bg-blue-50 border-primary text-title'
                    : 'bg-surface-app border-border-subtle text-text-secondary'
                }`}
              >
                <div className="font-bold">Mức 1: Tiêu Chuẩn (1.00)</div>
                <div className="text-[11px] mt-1 text-text-secondary">Kiện hộp chữ nhật chuẩn, có thể xếp chồng bình thường</div>
              </div>

              <div
                className={`p-3.5 rounded-xl border transition ${
                  pricingPreview.hgFactorBps === pricingConfig.irregularSurchargeBps
                    ? 'bg-amber-50 border-amber-500 text-title'
                    : 'bg-surface-app border-border-subtle text-text-secondary'
                }`}
              >
                <div className="font-bold text-amber-700">Mức 2: Dễ vỡ / Tỉ lệ lệch (1.15)</div>
                <div className="text-[11px] mt-1 text-text-secondary">Kiện cờ dễ vỡ hoặc tỉ lệ cạnh max/min &gt; {pricingConfig.maxEdgeRatioThreshold}</div>
              </div>

              <div
                className={`p-3.5 rounded-xl border transition ${
                  pricingPreview.hgFactorBps === pricingConfig.noStackSurchargeBps
                    ? 'bg-rose-50 border-rose-500 text-title'
                    : 'bg-surface-app border-border-subtle text-text-secondary'
                }`}
              >
                <div className="font-bold text-rose-700">Mức 3: Cấm xếp chồng (1.30)</div>
                <div className="text-[11px] mt-1 text-text-secondary">Chiếm trọn cột không gian container theo phương đứng</div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-app border border-border-subtle text-xs text-text-secondary space-y-1">
              <div>
                Hệ số Hg áp dụng: <span className="font-bold text-title font-mono-numeric">{(pricingPreview.hgFactorBps / 10000).toFixed(2)}</span> ({pricingPreview.hgReason})
              </div>
              <div>
                Phụ phí hình học: <span className="font-bold text-amber-600 font-mono-numeric">+{formatVnd(pricingPreview.surchargeFee)}</span>
              </div>
              <div>
                Phí cố định: <span className="font-bold text-title font-mono-numeric">+{formatVnd(pricingPreview.fixedFee)}</span>
              </div>
            </div>
          </Card>

          {/* Desktop in-flow buttons */}
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              size="md"
              onClick={() => setCurrentStep(2)}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Sửa Kiện Hàng
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setCurrentStep(4)}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Tiếp tục Xác Nhận
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Final Confirmation */}
      {currentStep === 4 && pricingPreview && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-title">Bước 4: Xác Nhận & Tạo Lô Hàng</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Kiểm tra thông tin lần cuối trước khi lưu vào hệ thống
            </p>
          </div>

          {submitError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {submitError}
            </div>
          )}

          <Card className="p-6 bg-surface-card border-border-subtle shadow-sm space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-surface-app border border-border-subtle">
                <span className="text-text-secondary">Tuyến đường:</span>
                <div className="font-bold text-title mt-1">{selectedLane?.name}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-app border border-border-subtle">
                <span className="text-text-secondary">Tổng số kiện:</span>
                <div className="font-bold text-title mt-1 font-mono-numeric">{packages.length} kiện</div>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-app border border-border-subtle">
                <span className="text-text-secondary">Tổng thể tích:</span>
                <div className="font-bold text-title mt-1 font-mono-numeric">{cbmFromVolumeMm3(pricingPreview.totalVolumeMm3)} m³</div>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-app border border-border-subtle">
                <span className="text-text-secondary">Tổng khối lượng:</span>
                <div className="font-bold text-title mt-1 font-mono-numeric">{kgFromWeightGrams(pricingPreview.totalWeightGrams)} kg</div>
              </div>
            </div>

            <div className="pt-4 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs text-text-secondary">Tổng chi phí vận tải ước tính:</div>
                <div className="text-2xl sm:text-3xl font-mono-numeric font-black text-emerald-600 mt-1">
                  {formatVnd(pricingPreview.totalAmount)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  disabled={isSubmitting}
                  onClick={() => handleCreateShipment(false)}
                >
                  Lưu Bản Nháp
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  disabled={isSubmitting}
                  isLoading={isSubmitting}
                  onClick={() => handleCreateShipment(true)}
                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                >
                  Xác Nhận & Gửi Lô Hàng
                </Button>
              </div>
            </div>
          </Card>

          <div className="flex justify-start">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep(3)}
              leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}
            >
              Quay lại Báo Giá
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
