'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import { ShipmentStatus, cbmFromVolumeMm3, kgFromWeightGrams } from '@logix/shared';
import { Plus, Package, ArrowRight, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

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

  const { data, isLoading, isError, error, refetch } = useQuery<ShipmentListResponse>({
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

  const getStatusBadge = (status: ShipmentStatus) => {
    switch (status) {
      case ShipmentStatus.DRAFT:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">Bản nháp</span>;
      case ShipmentStatus.PRICED:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-950 text-blue-300 border border-blue-800">Đã báo giá</span>;
      case ShipmentStatus.SUBMITTED:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950 text-amber-300 border border-amber-800">Đã gửi</span>;
      case ShipmentStatus.CONFIRMED:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">Đã xác nhận</span>;
      case ShipmentStatus.IN_TRANSIT:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-950 text-purple-300 border border-purple-800">Đang vận chuyển</span>;
      case ShipmentStatus.DELIVERED:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-950 text-green-300 border border-green-800">Đã giao</span>;
      case ShipmentStatus.CANCELLED:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-950 text-red-300 border border-red-800">Đã hủy</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300">{status}</span>;
    }
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
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-500" />
            Danh Sách Lô Hàng
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Quản lý lô hàng, đóng gói kiện hàng và tính cước theo biểu giá chuẩn hóa
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Làm mới"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <Link
            href="/shipments/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition"
          >
            <Plus className="h-4 w-4" />
            Tạo Lô Hàng Mới
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 text-xs">
        {[
          { key: 'ALL', label: 'Tất cả' },
          { key: ShipmentStatus.DRAFT, label: 'Bản nháp' },
          { key: ShipmentStatus.PRICED, label: 'Đã báo giá' },
          { key: ShipmentStatus.SUBMITTED, label: 'Đã gửi' },
          { key: ShipmentStatus.CONFIRMED, label: 'Đã xác nhận' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setSelectedStatus(tab.key);
              setCursorStack([]);
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              selectedStatus === tab.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table / Content */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
            Đang tải danh sách lô hàng...
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-red-400 text-sm">
            Lỗi khi tải danh sách: {(error as any)?.message || 'Không thể kết nối API'}
          </div>
        ) : !data?.items.length ? (
          <div className="p-12 text-center text-slate-400">
            <Package className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-semibold text-white">Chưa có lô hàng nào</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Bắt đầu tạo lô hàng đầu tiên để tính cước và xếp tải container 3D
            </p>
            <div className="mt-5">
              <Link
                href="/shipments/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition"
              >
                <Plus className="h-4 w-4" />
                Tạo lô hàng ngay
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 uppercase tracking-wider text-[11px] text-slate-400 border-b border-slate-800 font-semibold">
                <tr>
                  <th className="px-4 py-3.5">Mã Vận Đơn</th>
                  <th className="px-4 py-3.5">Tuyến Đường</th>
                  <th className="px-4 py-3.5 text-center">Số Kiện</th>
                  <th className="px-4 py-3.5 text-right">Thể Tích (CBM)</th>
                  <th className="px-4 py-3.5 text-right">Khối Lượng (kg)</th>
                  <th className="px-4 py-3.5 text-center">Tính Cước Theo</th>
                  <th className="px-4 py-3.5 text-right">Tổng Cước (VNĐ)</th>
                  <th className="px-4 py-3.5 text-center">Trạng Thái</th>
                  <th className="px-4 py-3.5 text-right">Ngày Tạo</th>
                  <th className="px-4 py-3.5 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.items.map((shp) => (
                  <tr key={shp.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3.5 font-mono font-semibold text-white">
                      {shp.trackingCode}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-white">{shp.lane.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{shp.lane.code}</div>
                    </td>
                    <td className="px-4 py-3.5 text-center font-medium">
                      {shp.totalPackages}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono">
                      {cbmFromVolumeMm3(BigInt(shp.volumeMm3))} m³
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono">
                      {kgFromWeightGrams(BigInt(shp.weightGrams))} kg
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          shp.chargeableBasis === 'VOLUME'
                            ? 'bg-sky-950 text-sky-400 border border-sky-800'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}
                      >
                        {shp.chargeableBasis === 'VOLUME' ? 'Thể tích' : 'Khối lượng'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-emerald-400 font-mono text-sm">
                      {formatVnd(shp.totalAmount)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {getStatusBadge(shp.status)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-slate-400 text-[11px]">
                      {new Date(shp.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Link
                        href={`/shipments/${shp.id}`}
                        className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium text-xs transition"
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
          <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-950/40">
            <div>
              Trang {cursorStack.length + 1}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={cursorStack.length === 0}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center gap-1 transition"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Trang trước
              </button>
              <button
                onClick={handleNextPage}
                disabled={!data.hasMore}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center gap-1 transition"
              >
                Trang sau <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
