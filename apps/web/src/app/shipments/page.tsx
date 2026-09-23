'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import { ShipmentStatus, cbmFromVolumeMm3, kgFromWeightGrams } from '@logix/shared';
import { Plus, Package, ArrowRight, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, StatusBadge, Card, EmptyState } from '@/components/ui';

interface Lane {
  id: string;
  code: string;
  name: string;
  origin: string;
  destination: string;
}

interface PricingConfig {
  id: string;
  version: number;
  cbmRate: string;
  weightRateKg: string;
}

interface Shipment {
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
  createdAt: string;
  lane: Lane;
  pricingConfig: PricingConfig;
}

interface ShipmentListResponse {
  items: Shipment[];
  nextCursor: string | null;
  hasMore: boolean;
}

export default function ShipmentsPage() {
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const currentCursor = cursorStack.length > 0 ? cursorStack[cursorStack.length - 1] : undefined;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ShipmentListResponse>({
    queryKey: ['shipments', selectedStatus, currentCursor],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentCursor) params.append('cursor', currentCursor);
      params.append('limit', '10');
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);

      return fetchApi<ShipmentListResponse>(`/shipments?${params.toString()}`);
    },
    staleTime: 5000,
  });

  const formatVnd = (val: string | number) => {
    const num = typeof val === 'string' ? Number(val) : val;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  const handleNextPage = () => {
    if (data?.nextCursor) {
      setCursorStack([...cursorStack, data.nextCursor]);
    }
  };

  const handlePrevPage = () => {
    if (cursorStack.length > 0) {
      setCursorStack(cursorStack.slice(0, -1));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-title tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Package className="h-5 w-5" />
            </div>
            Danh Sách Lô Hàng LCL
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Quản lý lô hàng, thông số kiện hàng và tính cước vận tải chuẩn hóa
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />}
            title="Làm mới dữ liệu"
          >
            Làm mới
          </Button>
          <Link href="/shipments/new">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Tạo Lô Hàng Mới
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { key: 'ALL', label: 'Tất cả' },
          { key: ShipmentStatus.DRAFT, label: 'Bản nháp' },
          { key: ShipmentStatus.PRICED, label: 'Đã báo giá' },
          { key: ShipmentStatus.SUBMITTED, label: 'Chờ gom hàng' },
          { key: ShipmentStatus.CONFIRMED, label: 'Đã xác nhận' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setSelectedStatus(tab.key);
              setCursorStack([]);
            }}
            className={`px-3.5 py-1.5 rounded-xl font-medium transition cursor-pointer whitespace-nowrap ${
              selectedStatus === tab.key
                ? 'bg-primary text-white shadow-sm shadow-primary/20'
                : 'bg-surface-card border border-border-input text-text-secondary hover:bg-surface-hover hover:text-title'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table / Content */}
      <Card className="overflow-hidden border-border-subtle bg-surface-card shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-text-secondary text-sm">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
            Đang tải danh sách lô hàng...
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-rose-600 text-sm">
            Lỗi khi tải danh sách: {(error as any)?.message || 'Không thể kết nối API'}
          </div>
        ) : !data?.items.length ? (
          <EmptyState
            title="Chưa có lô hàng nào"
            description="Bắt đầu tạo lô hàng đầu tiên để tính cước tự động và xếp tải vào container 3D"
            actionLabel="Tạo lô hàng ngay"
            onAction={() => (window.location.href = '/shipments/new')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-app uppercase tracking-wider text-[11px] text-text-secondary border-b border-border-subtle font-semibold whitespace-nowrap">
                <tr>
                  <th className="px-4 sm:px-6 py-3.5">Mã Vận Đơn</th>
                  <th className="px-4 py-3.5">Tuyến Đường</th>
                  <th className="px-4 py-3.5 text-center">Số Kiện</th>
                  <th className="px-4 py-3.5 text-right">Thể Tích (CBM)</th>
                  <th className="px-4 py-3.5 text-right">Khối Lượng (kg)</th>
                  <th className="px-4 py-3.5 text-center">Cơ Sở Tính Cước</th>
                  <th className="px-4 py-3.5 text-right">Tổng Cước</th>
                  <th className="px-4 py-3.5 text-center">Trạng Thái</th>
                  <th className="px-4 py-3.5 text-right">Ngày Tạo</th>
                  <th className="px-4 sm:px-6 py-3.5 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {data.items.map((shp) => (
                  <tr key={shp.id} className="hover:bg-surface-app transition-colors duration-150">
                    <td className="px-4 sm:px-6 py-3.5 font-mono-numeric font-bold text-title">
                      {shp.trackingCode}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-title">{shp.lane.name}</div>
                      <div className="text-[11px] text-text-secondary font-mono-numeric">{shp.lane.code}</div>
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono-numeric font-medium text-body">
                      {shp.totalPackages}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-numeric text-body font-medium">
                      {cbmFromVolumeMm3(BigInt(shp.volumeMm3))} m³
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-numeric text-body font-medium">
                      {kgFromWeightGrams(BigInt(shp.weightGrams))} kg
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                          shp.chargeableBasis === 'VOLUME'
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {shp.chargeableBasis === 'VOLUME' ? 'Thể tích (CBM)' : 'Khối lượng (KG)'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-emerald-600 font-mono-numeric text-sm">
                      {formatVnd(shp.totalAmount)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <StatusBadge status={shp.status} size="sm" />
                    </td>
                    <td className="px-4 py-3.5 text-right text-text-secondary font-mono-numeric text-[11px]">
                      {new Date(shp.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 text-center">
                      <Link
                        href={`/shipments/${shp.id}`}
                        className="inline-flex items-center gap-1 font-semibold text-xs text-primary hover:text-primary-hover transition"
                      >
                        Chi tiết <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data && data.items.length > 0 && (
          <div className="px-4 sm:px-6 py-3.5 border-t border-border-subtle flex items-center justify-between text-xs text-text-secondary bg-surface-app/60">
            <div>
              Trang <span className="font-semibold text-title font-mono-numeric">{cursorStack.length + 1}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={cursorStack.length === 0}
                leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
              >
                Trang trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!data.hasMore}
                rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
              >
                Trang sau
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
