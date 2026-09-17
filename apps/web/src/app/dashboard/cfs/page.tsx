'use client';

import React from 'react';
import Link from 'next/link';
import { Box, ArrowRight } from 'lucide-react';

export default function CfsWarehouseDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Bảng Điều Khiển Kho CFS (CFS Warehouse)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Quản lý nhập kho, đối soát kích thước thực tế (Tally & Measurement), và xếp dỡ trực quan.
          </p>
        </div>
      </div>

      {/* Real stats / Phase 5 placeholders */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Lô Hàng Chờ Đo Đạc Kiểm Đếm (Tally)
          </div>
          <div className="mt-2 text-3xl font-extrabold text-amber-400 font-mono">0</div>
          <div className="mt-1 text-xs text-slate-500">Chưa có lô hàng nào cần đối soát tại kho</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Kiện Hàng Đang Lưu Kho
          </div>
          <div className="mt-2 text-3xl font-extrabold text-blue-400 font-mono">0</div>
          <div className="mt-1 text-xs text-slate-500">Kho hàng hiện tại chưa tiếp nhận kiện</div>
        </div>
      </div>

      {/* Real empty state for CFS packages */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-base font-bold text-white mb-4">
          Danh sách lô hàng nhập kho CFS chờ kiểm tra
        </h2>
        <div className="py-12 text-center text-slate-400">
          <Box className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-white">Chưa có kiện hàng nhập kho CFS</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Quy trình đối soát kích thước thực tế (Tally & Measurement) tại kho sẽ sẵn sàng trong Phase 5.
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
