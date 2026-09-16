'use client';

import React from 'react';

export default function ShipperDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Bảng Điều Khiển Chủ Hàng (Shipper)
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Quản lý đơn booking, tính toán thể tích lô hàng LCL, và theo dõi container.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Lô Hàng Đang Gom
          </div>
          <div className="mt-2 text-3xl font-extrabold text-blue-400">12</div>
          <div className="mt-1 text-xs text-slate-500">CBM tổng: 34.8 m³</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Container Đang Xếp
          </div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-400">3</div>
          <div className="mt-1 text-xs text-slate-500">Hiệu suất thể tích: 91.2%</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tỷ lệ Tối ưu Thể tích
          </div>
          <div className="mt-2 text-3xl font-extrabold text-amber-400">92.4%</div>
          <div className="mt-1 text-xs text-slate-500">+4.1% so với tháng trước</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Chi Phí Tiết Kiệm
          </div>
          <div className="mt-2 text-3xl font-extrabold text-indigo-400">$18,450</div>
          <div className="mt-1 text-xs text-slate-500">Nhờ thuật toán 3D packing</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-base font-bold text-white mb-4">
          Lô hàng LCL gần đây
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Mã Booking</th>
                <th className="px-4 py-3">Điểm Đi - Đến</th>
                <th className="px-4 py-3">Số Kiện</th>
                <th className="px-4 py-3">Thể tích (CBM)</th>
                <th className="px-4 py-3">Trọng lượng (Kg)</th>
                <th className="px-4 py-3 rounded-r-lg">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <tr>
                <td className="px-4 py-3.5 font-medium text-white">BK-2026-0891</td>
                <td className="px-4 py-3.5">Hải Phòng → Busan</td>
                <td className="px-4 py-3.5">45 kiện</td>
                <td className="px-4 py-3.5">8.4 m³</td>
                <td className="px-4 py-3.5">2,300 kg</td>
                <td className="px-4 py-3.5">
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                    Đã Xếp 3D
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3.5 font-medium text-white">BK-2026-0892</td>
                <td className="px-4 py-3.5">Cát Lái → Singapore</td>
                <td className="px-4 py-3.5">120 kiện</td>
                <td className="px-4 py-3.5">18.2 m³</td>
                <td className="px-4 py-3.5">5,800 kg</td>
                <td className="px-4 py-3.5">
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/60">
                    Đang Chờ Gom
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
