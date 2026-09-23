'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import { ShipmentStatus, cbmFromVolumeMm3, kgFromWeightGrams } from '@logix/shared';
import { Package, Plus, ArrowRight, RefreshCw, LayoutDashboard } from 'lucide-react';
import { Button, StatusBadge, Card, EmptyState } from '@/components/ui';

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

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-title flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            Bảng Điều Khiển Chủ Hàng (Shipper)
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Quản lý đơn hàng, theo dõi thể tích hàng hóa LCL và biểu cước vận chuyển thực tế.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/shipments/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              Tạo Lô Hàng Mới
            </Button>
          </Link>
        </div>
      </div>

      {/* Real Stat Cards from DB */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 bg-surface-card border-border-subtle shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Tổng Số Lô Hàng
          </div>
          <div className="mt-2 text-3xl font-extrabold text-title font-mono-numeric">
            {loadingStats ? '...' : (stats?.totalShipments ?? 0)}
          </div>
          <div className="mt-1 text-xs text-text-muted">Thuộc tài khoản doanh nghiệp</div>
        </Card>

        <Card className="p-5 bg-surface-card border-border-subtle shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Tổng Thể Tích (CBM)
          </div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-600 font-mono-numeric">
            {loadingStats ? '...' : `${stats?.totalCbm ?? '0.0000'} m³`}
          </div>
          <div className="mt-1 text-xs text-text-muted">Quy đổi từ kích thước kiện</div>
        </Card>

        <Card className="p-5 bg-surface-card border-border-subtle shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Tổng Trọng Lượng (Kg)
          </div>
          <div className="mt-2 text-3xl font-extrabold text-amber-600 font-mono-numeric">
            {loadingStats ? '...' : `${stats?.totalWeightKg ?? '0.00'} kg`}
          </div>
          <div className="mt-1 text-xs text-text-muted">Khối lượng cân nặng thực tế</div>
        </Card>

        <Card className="p-5 bg-primary-tint border-blue-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            Tổng Cước Phí Dự Kiến
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 font-mono-numeric">
            {loadingStats ? '...' : formatVnd(stats?.totalAmount)}
          </div>
          <div className="mt-1 text-xs text-text-secondary">Tính theo biểu cước chuẩn hóa</div>
        </Card>
      </div>

      {/* Real Shipments Table or Empty State */}
      <Card className="p-6 bg-surface-card border-border-subtle shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-title flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Lô Hàng Gần Đây
          </h2>
          <Link
            href="/shipments"
            className="text-xs text-primary hover:text-primary-hover font-semibold inline-flex items-center gap-1 transition"
          >
            Xem tất cả <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {loadingRecent ? (
          <div className="py-8 text-center text-xs text-text-secondary">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
            Đang tải dữ liệu lô hàng...
          </div>
        ) : !recentData?.items?.length ? (
          <EmptyState
            title="Chưa có lô hàng nào"
            description="Doanh nghiệp của bạn chưa tạo lô hàng nào. Bắt đầu tạo lô hàng đầu tiên để vận chuyển."
            actionLabel="Tạo lô hàng ngay"
            onAction={() => (window.location.href = '/shipments/new')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-app text-text-secondary uppercase text-[11px] font-semibold border-b border-border-subtle">
                <tr>
                  <th className="px-4 py-3">Mã Vận Đơn</th>
                  <th className="px-4 py-3">Tuyến Vận Tải</th>
                  <th className="px-4 py-3 text-center">Số Kiện</th>
                  <th className="px-4 py-3 text-right">Thể Tích (CBM)</th>
                  <th className="px-4 py-3 text-right">Trọng Lượng (Kg)</th>
                  <th className="px-4 py-3 text-right">Tổng Cước</th>
                  <th className="px-4 py-3 text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {recentData.items.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-app transition-colors">
                    <td className="px-4 py-3.5 font-mono-numeric font-bold text-title">
                      <Link href={`/shipments/${s.id}`} className="hover:text-primary transition">
                        {s.trackingCode}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-body">
                      {s.lane ? `${s.lane.origin} → ${s.lane.destination}` : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono-numeric text-body">{s.totalPackages}</td>
                    <td className="px-4 py-3.5 text-right font-mono-numeric text-body font-medium">{cbmFromVolumeMm3(BigInt(s.volumeMm3))} m³</td>
                    <td className="px-4 py-3.5 text-right font-mono-numeric text-body font-medium">{kgFromWeightGrams(BigInt(s.weightGrams))} kg</td>
                    <td className="px-4 py-3.5 text-right font-mono-numeric font-bold text-emerald-600">{formatVnd(s.totalAmount)}</td>
                    <td className="px-4 py-3.5 text-center"><StatusBadge status={s.status} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
