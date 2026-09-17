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
} from 'lucide-react';

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

  const getStatusBadge = (status: ShipmentStatus) => {
    switch (status) {
      case ShipmentStatus.DRAFT:
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">Bản nháp</span>;
      case ShipmentStatus.PRICED:
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-800">Đã báo giá</span>;
      case ShipmentStatus.SUBMITTED:
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">Đã gửi</span>;
      case ShipmentStatus.CONFIRMED:
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">Đã xác nhận</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400 text-sm">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
        Đang tải thông tin chi tiết lô hàng...
      </div>
    );
  }

  if (isError || !shipment) {
    return (
      <div className="p-8 text-center text-red-400 text-sm">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
        Không thể tải thông tin lô hàng: {(error as any)?.message || 'Lỗi không xác định'}
        <div className="mt-4">
          <Link href="/shipments" className="text-blue-400 underline text-xs">
            Quay về danh sách
          </Link>
        </div>
      </div>
    );
  }

  const isDraftOrPriced = shipment.status === ShipmentStatus.DRAFT || shipment.status === ShipmentStatus.PRICED;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <Link href="/shipments" className="hover:text-blue-400 transition">
              Danh sách Lô hàng
            </Link>
            <span>/</span>
            <span className="text-white font-mono">{shipment.trackingCode}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight font-mono">
              {shipment.trackingCode}
            </h1>
            {getStatusBadge(shipment.status)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tuyến: <span className="text-white font-semibold">{shipment.lane.name}</span> ({shipment.lane.code}) • Tạo lúc: {new Date(shipment.createdAt).toLocaleString('vi-VN')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isDraftOrPriced && (
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || shipment.packages.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              {submitMutation.isPending ? 'Đang gửi...' : 'Gửi Phê Duyệt Lô Hàng'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-[11px] font-semibold text-slate-400">Tổng Số Kiện</div>
          <div className="text-2xl font-bold text-white mt-1">{shipment.totalPackages} kiện</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-[11px] font-semibold text-slate-400">Tổng Thể Tích</div>
          <div className="text-2xl font-mono font-bold text-white mt-1">
            {cbmFromVolumeMm3(BigInt(shipment.volumeMm3))} m³
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-[11px] font-semibold text-slate-400">Tổng Khối Lượng</div>
          <div className="text-2xl font-mono font-bold text-white mt-1">
            {kgFromWeightGrams(BigInt(shipment.weightGrams))} kg
          </div>
        </div>
        <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-800/80">
          <div className="text-[11px] font-semibold text-blue-300">Tổng Cước VNĐ</div>
          <div className="text-2xl font-mono font-black text-emerald-400 mt-1">
            {formatVnd(shipment.totalAmount)}
          </div>
        </div>
      </div>

      {shipment.pricingSnapshot && (
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
          <h3 className="text-sm font-bold text-white">Chi Tiết Bảng Cước & Phụ Phí Hình Học</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Hình thức tính cước:</span>
              <div className="font-bold text-white mt-0.5">
                {shipment.chargeableBasis === 'VOLUME' ? 'Theo Thể Tích (CBM)' : 'Theo Khối Lượng (kg)'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-1">
                Gốc: {formatVnd(shipment.pricingSnapshot.winningBaseAmount)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Hệ số Phụ phí Hg:</span>
              <div className="font-bold text-amber-300 mt-0.5 font-mono">
                {(shipment.pricingSnapshot.hgFactorBps / 10000).toFixed(2)} ({shipment.pricingSnapshot.hgReason})
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-1">
                Phụ phí: +{formatVnd(shipment.pricingSnapshot.surchargeFee)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Phí xử lý cố định:</span>
              <div className="font-bold text-white mt-0.5 font-mono">
                +{formatVnd(shipment.pricingSnapshot.fixedFee)}
              </div>
              <div className="text-[10px] text-emerald-400 font-mono mt-1 font-semibold">
                Tổng: {formatVnd(shipment.totalAmount)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white">Danh Sách Kiện Hàng Trong Lô</h3>
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 uppercase text-[11px] text-slate-400 border-b border-slate-800 font-semibold">
              <tr>
                <th className="px-4 py-3">Mã Kiện</th>
                <th className="px-4 py-3 text-right">Dài × Rộng × Cao (mm)</th>
                <th className="px-4 py-3 text-right">Thể Tích (CBM)</th>
                <th className="px-4 py-3 text-right">Khối Lượng (kg)</th>
                <th className="px-4 py-3 text-center">Dễ Vỡ</th>
                <th className="px-4 py-3 text-center">Không Chồng</th>
                <th className="px-4 py-3 text-center">Loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {shipment.packages.map((pkg) => (
                <tr key={pkg.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono font-semibold text-white">{pkg.packageCode}</td>
                  <td className="px-4 py-3 text-right font-mono">{pkg.lengthMm} × {pkg.widthMm} × {pkg.heightMm}</td>
                  <td className="px-4 py-3 text-right font-mono">{cbmFromVolumeMm3(BigInt(pkg.volumeMm3))}</td>
                  <td className="px-4 py-3 text-right font-mono">{kgFromWeightGrams(pkg.weightGrams)}</td>
                  <td className="px-4 py-3 text-center">{pkg.isFragile ? <span className="text-amber-400 font-bold">Có</span> : 'Không'}</td>
                  <td className="px-4 py-3 text-center">{pkg.noStack ? <span className="text-red-400 font-bold">Cấm xếp</span> : 'Cho phép'}</td>
                  <td className="px-4 py-3 text-center font-semibold">{pkg.packageType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
