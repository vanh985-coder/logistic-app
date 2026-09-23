'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import {
  ShipmentStatus,
  cbmFromVolumeMm3,
  kgFromWeightGrams,
} from '@logix/shared';
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Package,
  Layers,
} from 'lucide-react';
import { Button, StatusBadge, Card, CardContent } from '@/components/ui';

interface ShipmentDetail {
  id: string;
  trackingCode: string;
  status: ShipmentStatus;
  totalPackages: number;
  volumeMm3: string;
  weightGrams: string;
  chargeableBasis: 'VOLUME' | 'WEIGHT';
  baseAmount: string;
  surchargedAmount: string;
  totalAmount: string;
  pricingSnapshot: any;
  createdAt: string;
  lane: {
    id: string;
    code: string;
    name: string;
    origin: string;
    destination: string;
  };
  pricingConfig: {
    id: string;
    version: number;
    cbmRate: string;
    weightRateKg: string;
    fixedFee: string;
  };
  packages: Array<{
    id: string;
    packageCode: string;
    lengthMm: number;
    widthMm: number;
    heightMm: number;
    volumeMm3: string;
    weightGrams: number;
    isFragile: boolean;
    noStack: boolean;
    packageType: string;
  }>;
}

export default function ShipmentDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const shipmentId = params?.id as string;

  const { data: shipment, isLoading, isError, error } = useQuery<ShipmentDetail>({
    queryKey: ['shipment', shipmentId],
    queryFn: () => fetchApi<ShipmentDetail>(`/shipments/${shipmentId}`),
    enabled: !!shipmentId,
  });

  const submitMutation = useMutation({
    mutationFn: () => fetchApi(`/shipments/${shipmentId}/submit`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipment', shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
  });

  const formatVnd = (val: string | number | bigint) => {
    const num = typeof val === 'bigint' ? Number(val) : typeof val === 'string' ? Number(val) : val;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-text-secondary text-sm">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
        Đang tải thông tin chi tiết lô hàng...
      </div>
    );
  }

  if (isError || !shipment) {
    return (
      <div className="p-8 text-center text-rose-600 text-sm">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-rose-500" />
        Không thể tải thông tin lô hàng: {(error as any)?.message || 'Lỗi không xác định'}
        <div className="mt-4">
          <Link href="/shipments">
            <Button variant="outline" size="sm">Quay về danh sách</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isDraftOrPriced = shipment.status === ShipmentStatus.DRAFT || shipment.status === ShipmentStatus.PRICED;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-text-secondary mb-2">
            <Link href="/shipments" className="hover:text-primary transition flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Danh sách Lô hàng
            </Link>
            <span>/</span>
            <span className="text-title font-mono-numeric font-medium">{shipment.trackingCode}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-title tracking-tight font-mono-numeric">
              {shipment.trackingCode}
            </h1>
            <StatusBadge status={shipment.status} />
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Tuyến: <span className="text-title font-semibold">{shipment.lane.name}</span> ({shipment.lane.code}) • Tạo lúc: {new Date(shipment.createdAt).toLocaleString('vi-VN')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isDraftOrPriced && (
            <Button
              variant="primary"
              size="md"
              onClick={() => submitMutation.mutate()}
              isLoading={submitMutation.isPending}
              disabled={shipment.packages.length === 0}
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
            >
              Gửi Phê Duyệt Lô Hàng
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-surface-card border-border-subtle shadow-sm">
          <div className="text-xs font-semibold text-text-secondary">Tổng Số Kiện</div>
          <div className="text-2xl font-bold text-title mt-1 font-mono-numeric">{shipment.totalPackages} kiện</div>
        </Card>
        <Card className="p-4 bg-surface-card border-border-subtle shadow-sm">
          <div className="text-xs font-semibold text-text-secondary">Tổng Thể Tích</div>
          <div className="text-2xl font-bold text-title mt-1 font-mono-numeric">
            {cbmFromVolumeMm3(BigInt(shipment.volumeMm3))} m³
          </div>
        </Card>
        <Card className="p-4 bg-surface-card border-border-subtle shadow-sm">
          <div className="text-xs font-semibold text-text-secondary">Tổng Khối Lượng</div>
          <div className="text-2xl font-bold text-title mt-1 font-mono-numeric">
            {kgFromWeightGrams(BigInt(shipment.weightGrams))} kg
          </div>
        </Card>
        <Card className="p-4 bg-primary-tint border-blue-200 shadow-sm">
          <div className="text-xs font-semibold text-primary">Tổng Cước Dự Kiến</div>
          <div className="text-2xl font-black text-emerald-600 mt-1 font-mono-numeric">
            {formatVnd(shipment.totalAmount)}
          </div>
        </Card>
      </div>

      {/* Pricing Snapshot Breakdown */}
      {shipment.pricingSnapshot && (
        <Card className="bg-surface-card border-border-subtle shadow-sm overflow-hidden">
          <CardContent className="p-5 sm:p-6 space-y-3">
            <h3 className="text-sm font-bold text-title flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Chi Tiết Bảng Cước & Phụ Phí Hình Học
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-surface-app border border-border-subtle">
                <span className="text-text-secondary">Cơ sở tính cước trúng thầu:</span>
                <div className="font-bold text-title mt-1">
                  {shipment.chargeableBasis === 'VOLUME' ? 'Theo Thể Tích (CBM)' : 'Theo Khối Lượng (kg)'}
                </div>
                <div className="text-[11px] text-text-secondary font-mono-numeric mt-1">
                  Giá gốc: {formatVnd(shipment.pricingSnapshot.winningBaseAmount)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-app border border-border-subtle">
                <span className="text-text-secondary">Hệ số Phụ phí Hình học (Hg):</span>
                <div className="font-bold text-amber-600 mt-1 font-mono-numeric">
                  {(shipment.pricingSnapshot.hgFactorBps / 10000).toFixed(2)} ({shipment.pricingSnapshot.hgReason})
                </div>
                <div className="text-[11px] text-text-secondary font-mono-numeric mt-1">
                  Phụ phí: +{formatVnd(shipment.pricingSnapshot.surchargeFee)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-app border border-border-subtle">
                <span className="text-text-secondary">Phí cố định & Tổng cộng:</span>
                <div className="font-bold text-title mt-1 font-mono-numeric">
                  +{formatVnd(shipment.pricingSnapshot.fixedFee)}
                </div>
                <div className="text-xs text-emerald-600 font-mono-numeric mt-1 font-bold">
                  Tổng cước: {formatVnd(shipment.totalAmount)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Packages Table */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-title flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Danh Sách Kiện Hàng Trong Lô ({shipment.packages.length} kiện)
        </h3>
        <Card className="overflow-hidden bg-surface-card border-border-subtle shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-app uppercase text-[11px] text-text-secondary border-b border-border-subtle font-semibold">
                <tr>
                  <th className="px-4 sm:px-6 py-3">Mã Kiện</th>
                  <th className="px-4 py-3 text-right">Kích Thước D × R × C (mm)</th>
                  <th className="px-4 py-3 text-right">Thể Tích (CBM)</th>
                  <th className="px-4 py-3 text-right">Khối Lượng (kg)</th>
                  <th className="px-4 py-3 text-center">Dễ Vỡ</th>
                  <th className="px-4 py-3 text-center">Cấm Chồng</th>
                  <th className="px-4 sm:px-6 py-3 text-center">Loại Kiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {shipment.packages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-surface-app transition-colors">
                    <td className="px-4 sm:px-6 py-3 font-mono-numeric font-semibold text-title">{pkg.packageCode}</td>
                    <td className="px-4 py-3 text-right font-mono-numeric text-body">{pkg.lengthMm} × {pkg.widthMm} × {pkg.heightMm}</td>
                    <td className="px-4 py-3 text-right font-mono-numeric text-body font-medium">{cbmFromVolumeMm3(BigInt(pkg.volumeMm3))}</td>
                    <td className="px-4 py-3 text-right font-mono-numeric text-body font-medium">{kgFromWeightGrams(pkg.weightGrams)}</td>
                    <td className="px-4 py-3 text-center">
                      {pkg.isFragile ? (
                        <span className="text-amber-600 font-semibold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px]">Có</span>
                      ) : (
                        <span className="text-text-muted">Không</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {pkg.noStack ? (
                        <span className="text-rose-600 font-semibold px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-[10px]">Cấm xếp</span>
                      ) : (
                        <span className="text-text-muted">Cho phép</span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-center font-semibold text-title">{pkg.packageType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
