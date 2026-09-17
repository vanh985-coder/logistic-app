'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import { ShipmentStatus, cbmFromVolumeMm3, kgFromWeightGrams } from '@logix/shared';
import { Package, Plus, ArrowRight, RefreshCw } from 'lucide-react';

interface ShipmentStats {
  totalShipments: number;
  totalVolumeMm3: string;
  totalCbm: string;
  totalWeightGrams: string;
  totalWeightKg: string;
  totalAmount: string;
  byStatus: Record<string, number>;
}

interface Shipment {
  id: string;
  trackingCode: string;
  status: ShipmentStatus;
  totalPackages: number;
  volumeMm3: string;
  weightGrams: string;
  totalAmount: string;
  createdAt: string;
  lane: {
    name: string;
    origin: string;
    destination: string;
  };
}

interface ShipmentListResponse {
  items: Shipment[];
}

export default function ShipperDashboardPage() {
  const { data: stats, isLoading: loadingStats } = useQuery<ShipmentStats>({
    queryKey: ['shipments', 'stats'],
    queryFn: () => fetchApi<ShipmentStats>('/shipments/stats'),
    staleTime: 5000,
  });

  const { data: recentData, isLoading: loadingRecent } = useQuery<ShipmentListResponse>({
    queryKey: ['shipments', 'recent-5'],
    queryFn: () => fetchApi<ShipmentListResponse>('/shipments?limit=5'),
    staleTime: 5000,
  });

  const formatVnd = (val?: string | number) => {
    const num = typeof val === 'string' ? Number(val) : val || 0;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  const getStatusBadge = (status: ShipmentStatus) => {
    switch (status) {
      case ShipmentStatus.DRAFT:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">Bản nháp</span>;
      case ShipmentStatus.PRICED:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/60">Đã báo giá</span>;
      case ShipmentStatus.SUBMITTED:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60">Đã gửi</span>;
      case ShipmentStatus.CONFIRMED:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">Đã duyệt</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Bảng Điều Khiển Chủ Hàng (Shipper)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Quản lý đơn hàng, theo dõi thể tích hàng hóa LCL và biểu cước vận chuyển thực tế.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/shipments/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition"
          >
            <Plus className="h-4 w-4" />
            Tạo Lô Hàng Mới
          </Link>
        </div>
      </div>

      {/* Real Stat Cards from DB */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tổng Số Lô Hàng
          </div>
          <div className="mt-2 text-3xl font-extrabold text-blue-400 font-mono">
            {loadingStats ? '...' : (stats?.totalShipments ?? 0)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Thuộc tài khoản doanh nghiệp</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tổng Thể Tích (CBM)
          </div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-400 font-mono">
            {loadingStats ? '...' : `${stats?.totalCbm ?? '0.0000'} m³`}
          </div>
          <div className="mt-1 text-xs text-slate-500">Quy đổi từ kích thước kiện</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tổng Trọng Lượng (Kg)
          </div>
          <div className="mt-2 text-3xl font-extrabold text-amber-400 font-mono">
            {loadingStats ? '...' : `${stats?.totalWeightKg ?? '0.00'} kg`}
          </div>
          <div className="mt-1 text-xs text-slate-500">Khối lượng cân nặng thực tế</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tổng Cước Phí Dự Kiến
          </div>
          <div className="mt-2 text-2xl font-extrabold text-indigo-400 font-mono">
            {loadingStats ? '...' : formatVnd(stats?.totalAmount)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Tính theo biểu cước tự động</div>
        </div>
      </div>

      {/* Real Shipments Table or Empty State */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-white">
            Lô hàng gần đây
          </h2>
          <Link
            href="/shipments"
            className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
          >
            Xem tất cả <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {loadingRecent ? (
          <div className="py-8 text-center text-xs text-slate-500">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-500" />
            Đang tải dữ liệu lô hàng...
          </div>
        ) : !recentData?.items?.length ? (
          <div className="py-12 text-center text-slate-400">
            <Package className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-white">Chưa có lô hàng nào</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Doanh nghiệp của bạn chưa tạo lô hàng nào. Bắt đầu tạo lô hàng đầu tiên để vận chuyển.
            </p>
            <div className="mt-4">
              <Link
                href="/shipments/new"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition"
              >
                <Plus className="h-3.5 w-3.5" /> Tạo lô hàng ngay
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Mã Vận Đơn</th>
                  <th className="px-4 py-3">Tuyến Vận Tải</th>
                  <th className="px-4 py-3 text-center">Số Kiện</th>
                  <th className="px-4 py-3 text-right">Thể Tích (CBM)</th>
                  <th className="px-4 py-3 text-right">Trọng Lượng (Kg)</th>
                  <th className="px-4 py-3 text-right">Tổng Cước</th>
                  <th className="px-4 py-3 text-center rounded-r-lg">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {recentData.items.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3.5 font-mono font-medium text-white">
                      <Link href={`/shipments/${s.id}`} className="hover:underline text-blue-400">
                        {s.trackingCode}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">{s.lane ? `${s.lane.origin} → ${s.lane.destination}` : '—'}</td>
                    <td className="px-4 py-3.5 text-center font-mono">{s.totalPackages}</td>
                    <td className="px-4 py-3.5 text-right font-mono">{cbmFromVolumeMm3(BigInt(s.volumeMm3))} m³</td>
                    <td className="px-4 py-3.5 text-right font-mono">{kgFromWeightGrams(BigInt(s.weightGrams))} kg</td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-emerald-400">{formatVnd(s.totalAmount)}</td>
                    <td className="px-4 py-3.5 text-center">{getStatusBadge(s.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
