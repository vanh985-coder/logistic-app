'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import { Layers, ArrowRight } from 'lucide-react';

interface ShipmentStats {
  totalShipments: number;
  totalCbm: string;
  totalWeightKg: string;
  totalAmount: string;
}

export default function ForwarderDashboardPage() {
  const { data: stats, isLoading } = useQuery<ShipmentStats>({
    queryKey: ['shipments', 'stats'],
    queryFn: () => fetchApi<ShipmentStats>('/shipments/stats'),
    staleTime: 5000,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Bảng Điều Khiển Giao Nhận Vận Tải (Forwarder)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Lập kế hoạch đóng ghép container, tối ưu phân bổ tải trọng axle load, và phát lệnh hạ bãi.
          </p>
        </div>
      </div>

      {/* Real stats / Phase 3 placeholders */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Kế Hoạch Đóng Ghép (Consol)
          </div>
          <div className="mt-2 text-3xl font-extrabold text-blue-400 font-mono">0</div>
          <div className="mt-1 text-xs text-slate-500">Chưa có container nào được khởi tạo</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tổng Lô Hàng Khách Đã Ký
          </div>
          <div className="mt-2 text-3xl font-extrabold text-indigo-400 font-mono">
            {isLoading ? '...' : (stats?.totalShipments ?? 0)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Lô hàng đang ghi nhận trong hệ thống</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tổng Khối Tích Cần Gom (CBM)
          </div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-400 font-mono">
            {isLoading ? '...' : `${stats?.totalCbm ?? '0.0000'} m³`}
          </div>
          <div className="mt-1 text-xs text-slate-500">Dung tích cần phân bổ vỏ container</div>
        </div>
      </div>

      {/* Real empty state for Consol containers */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-base font-bold text-white mb-4">
          Kế hoạch đóng ghép container đang thực hiện
        </h2>
        <div className="py-12 text-center text-slate-400">
          <Layers className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-white">Chưa có kế hoạch đóng ghép container nào</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Tính năng đóng ghép tự động và thuật toán tối ưu xếp tải container 3D sẽ sẵn sàng trong Phase 3.
          </p>
          <div className="mt-4">
            <Link
              href="/shipments"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
            >
              Xem danh sách lô hàng <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
