'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import { MatchGroupDto } from '@logix/shared';
import { Layers, ArrowRight, Sparkles, Box, AlertCircle } from 'lucide-react';

interface MatchGroupStats {
  totalMatchGroups: number;
  activeMatchGroups: number;
  totalGroupedShipments: number;
  totalGroupedCbm: string;
  totalGroupedWeightKg: string;
  avgVolumeFillRate: number;
  avgWeightFillRate: number;
}

export default function ForwarderDashboardPage() {
  const queryClient = useQueryClient();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const { data: stats, isLoading: isStatsLoading } = useQuery<MatchGroupStats>({
    queryKey: ['match-groups', 'stats'],
    queryFn: () => fetchApi<MatchGroupStats>('/match-groups/stats'),
    staleTime: 5000,
  });

  const { data: groupsData, isLoading: isGroupsLoading } = useQuery<{ items: MatchGroupDto[] }>({
    queryKey: ['match-groups', 'list'],
    queryFn: () => fetchApi<{ items: MatchGroupDto[] }>('/match-groups?limit=10'),
    staleTime: 5000,
  });

  const proposeMutation = useMutation({
    mutationFn: () =>
      fetchApi<{ success: boolean; proposalsCount: number }>('/match-groups/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['match-groups'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setActionMessage(`Thuật toán đã tạo thành công ${data.proposalsCount} đề xuất ghép container mới!`);
      setTimeout(() => setActionMessage(null), 5000);
    },
    onError: (err: any) => {
      setActionMessage(`Lỗi chạy ghép hàng: ${err.message}`);
      setTimeout(() => setActionMessage(null), 5000);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/match-groups/${id}/confirm`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-groups'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setActionMessage('Đã chốt kế hoạch đóng ghép container thành công!');
      setTimeout(() => setActionMessage(null), 5000);
    },
    onError: (err: any) => {
      setActionMessage(`Lỗi chốt kế hoạch: ${err.message}`);
      setTimeout(() => setActionMessage(null), 5000);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/match-groups/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-groups'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setActionMessage('Đã hủy nhóm ghép cont, các lô hàng đã được hoàn về trạng thái chờ gom.');
      setTimeout(() => setActionMessage(null), 5000);
    },
    onError: (err: any) => {
      setActionMessage(`Lỗi hủy nhóm: ${err.message}`);
      setTimeout(() => setActionMessage(null), 5000);
    },
  });

  const groups = groupsData?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Bảng Điều Khiển Giao Nhận Vận Tải (Forwarder)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Lập kế hoạch đóng ghép container LCL, tối ưu tỷ lệ lấp đầy thể tích và phân bổ tải trọng axle load.
          </p>
        </div>

        <button
          onClick={() => proposeMutation.mutate()}
          disabled={proposeMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition shadow-lg shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
        >
          <Sparkles className="h-4 w-4" />
          {proposeMutation.isPending ? 'Đang chạy thuật toán...' : 'Đề xuất ghép hàng tự động'}
        </button>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-lg bg-blue-950/60 border border-blue-800 text-blue-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white text-xs">
            Đóng
          </button>
        </div>
      )}

      {/* Real Statistics Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Kế Hoạch Đang Hoạt Động
          </div>
          <div className="mt-2 text-3xl font-extrabold text-blue-400 font-mono">
            {isStatsLoading ? '...' : (stats?.activeMatchGroups ?? 0)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Container đang đề xuất hoặc đã chốt</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Lô Hàng Đã Ghép
          </div>
          <div className="mt-2 text-3xl font-extrabold text-indigo-400 font-mono">
            {isStatsLoading ? '...' : (stats?.totalGroupedShipments ?? 0)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Lô hàng nằm trong các nhóm consol</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tổng Khối Tích Đã Gom
          </div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-400 font-mono">
            {isStatsLoading ? '...' : `${stats?.totalGroupedCbm ?? '0.00'} m³`}
          </div>
          <div className="mt-1 text-xs text-slate-500">Dung tích hàng hóa đã được bố trí</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tỷ Lệ Lấp Đầy TB
          </div>
          <div className="mt-2 text-3xl font-extrabold text-amber-400 font-mono">
            {isStatsLoading ? '...' : `${stats?.avgVolumeFillRate ?? 0}%`}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Tải trọng: {stats?.avgWeightFillRate ?? 0}%
          </div>
        </div>
      </div>

      {/* Match Groups List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">
            Kế hoạch đóng ghép container đang thực hiện
          </h2>
          <Link
            href="/match-groups"
            className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
          >
            Xem tất cả <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {isGroupsLoading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Đang tải danh sách nhóm ghép...</div>
        ) : groups.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Layers className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-white">Chưa có kế hoạch đóng ghép container nào</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Nhấn nút &quot;Đề xuất ghép hàng tự động&quot; phía trên để thuật toán tự động quét các lô hàng đã gửi và tối ưu container.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium">
                  <th className="py-3 px-4">Mã Nhóm</th>
                  <th className="py-3 px-4">Tuyến Vận Chuyển</th>
                  <th className="py-3 px-4">Vỏ Container</th>
                  <th className="py-3 px-4">Số Lô Hàng</th>
                  <th className="py-3 px-4">Lấp Đầy Thể Tích</th>
                  <th className="py-3 px-4">Tải Trọng</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {groups.map((g) => {
                  const volRate = g.volumeFillRate;
                  return (
                    <tr key={g.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        <Link href={`/match-groups/${g.id}`} className="hover:text-blue-400">
                          {g.code}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {g.lane ? `${g.lane.origin} → ${g.lane.destination}` : g.laneId}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px]">
                          <Box className="h-3 w-3 text-blue-400" />
                          {g.targetContainerType?.code || 'Cont'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-medium">
                        {g.shipmentCount} lô hàng
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-32">
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-300 font-medium">{volRate}%</span>
                            <span className="text-slate-500">{g.totalCbm} m³</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${
                                volRate > 80 ? 'bg-emerald-500' : volRate > 50 ? 'bg-blue-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(volRate, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-32">
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-300 font-medium">{g.weightFillRate}%</span>
                            <span className="text-slate-500">{g.totalWeightKg} kg</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-1.5 rounded-full bg-indigo-500"
                              style={{ width: `${Math.min(g.weightFillRate, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            g.status === 'PROPOSED'
                              ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                              : g.status === 'CONFIRMED'
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {g.status === 'PROPOSED'
                            ? 'Đang đề xuất'
                            : g.status === 'CONFIRMED'
                            ? 'Đã chốt ghép'
                            : g.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Link
                          href={`/match-groups/${g.id}`}
                          className="px-2.5 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        >
                          Chi tiết
                        </Link>
                        {g.status === 'PROPOSED' && (
                          <button
                            onClick={() => confirmMutation.mutate(g.id)}
                            disabled={confirmMutation.isPending}
                            className="px-2.5 py-1 text-[11px] rounded bg-emerald-700 hover:bg-emerald-600 text-white font-medium transition cursor-pointer"
                          >
                            Chốt ghép
                          </button>
                        )}
                        {(g.status === 'PROPOSED' || g.status === 'CONFIRMED') && (
                          <button
                            onClick={() => cancelMutation.mutate(g.id)}
                            disabled={cancelMutation.isPending}
                            className="px-2.5 py-1 text-[11px] rounded bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-800 transition cursor-pointer"
                          >
                            Hủy
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
