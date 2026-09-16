'use client';

import React from 'react';

export default function ForwarderDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Bảng Điều Khiển Giao Nhận Vận Tải (Forwarder)
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Lập kế hoạch đóng ghép container, tối ưu phân bổ tải trọng axle load, và phát lệnh hạ bãi.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Kế Hoạch Đóng Ghép (Consol)
          </div>
          <div className="mt-2 text-3xl font-extrabold text-blue-400">8</div>
          <div className="mt-1 text-xs text-slate-500">5 x 40HC, 3 x 20GP</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tổng Lô Hàng Khách Ký
          </div>
          <div className="mt-2 text-3xl font-extrabold text-indigo-400">64</div>
          <div className="mt-1 text-xs text-slate-500">Từ 18 doanh nghiệp Shipper</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Hệ Số Lấp Đầy Trung Bình
          </div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-400">93.8%</div>
          <div className="mt-1 text-xs text-slate-500">Không quá tải trọng axle</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Container Sẵn Sàng Xuất
          </div>
          <div className="mt-2 text-3xl font-extrabold text-amber-400">4</div>
          <div className="mt-1 text-xs text-slate-500">Chờ lệnh CFS đóng hàng</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-base font-bold text-white mb-4">
          Kế hoạch đóng ghép container đang thực hiện
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Mã Container Consol</th>
                <th className="px-4 py-3">Tuyến Vận Tải</th>
                <th className="px-4 py-3">Quy Cách Vỏ</th>
                <th className="px-4 py-3">Số Lô LCL</th>
                <th className="px-4 py-3">Tỷ Lệ Thể Tích</th>
                <th className="px-4 py-3 rounded-r-lg">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <tr>
                <td className="px-4 py-3.5 font-medium text-white">CS-40HC-VNHPG-KRPUS-01</td>
                <td className="px-4 py-3.5">Hải Phòng → Busan</td>
                <td className="px-4 py-3.5">40ft High Cube</td>
                <td className="px-4 py-3.5">14 chủ hàng</td>
                <td className="px-4 py-3.5 text-emerald-400 font-semibold">95.2% (72.4 / 76 m³)</td>
                <td className="px-4 py-3.5">
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                    Sẵn sàng hạ bãi
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
