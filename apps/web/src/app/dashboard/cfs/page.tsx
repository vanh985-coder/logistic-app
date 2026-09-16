'use client';

import React from 'react';

export default function CfsWarehouseDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Bảng Điều Khiển Kho CFS (CFS Warehouse)
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Quản lý nhập kho, đối soát kích thước thực tế (Tally & Measurement), và xếp dỡ trực quan.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Lô Hàng Chờ Đo Đạc (Tally)
          </div>
          <div className="mt-2 text-3xl font-extrabold text-amber-400">5</div>
          <div className="mt-1 text-xs text-slate-500">Cần xác nhận trọng lượng thực</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Kiện Hàng Trong Kho
          </div>
          <div className="mt-2 text-3xl font-extrabold text-blue-400">342</div>
          <div className="mt-1 text-xs text-slate-500">Tổng thể tích kho: 540 m³</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Lệnh Đóng Hàng Hôm Nay
          </div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-400">2</div>
          <div className="mt-1 text-xs text-slate-500">Theo sơ đồ xếp 3D tuần tự</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Độ Sai Lệch Khai Báo TB
          </div>
          <div className="mt-2 text-3xl font-extrabold text-indigo-400">±1.8%</div>
          <div className="mt-1 text-xs text-slate-500">Tự động cân chỉnh lại sơ đồ 3D</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-base font-bold text-white mb-4">
          Danh sách lô hàng nhập kho CFS chờ kiểm tra
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Mã Kiện Kho</th>
                <th className="px-4 py-3">Chủ Hàng</th>
                <th className="px-4 py-3">Kích Thước Khai Báo (DxRxC)</th>
                <th className="px-4 py-3">Kích Thước Đo Thực Tế</th>
                <th className="px-4 py-3">Vị Trí Ô Kệ</th>
                <th className="px-4 py-3 rounded-r-lg">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <tr>
                <td className="px-4 py-3.5 font-medium text-white">CFS-IN-1092</td>
                <td className="px-4 py-3.5">Logistics Á Châu</td>
                <td className="px-4 py-3.5">120 x 80 x 160 cm</td>
                <td className="px-4 py-3.5 text-emerald-400">120 x 80 x 160 cm (Khớp)</td>
                <td className="px-4 py-3.5">Khu A - Bay 04</td>
                <td className="px-4 py-3.5">
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                    Đã kiểm đếm
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
