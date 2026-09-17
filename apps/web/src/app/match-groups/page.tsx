'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import { MatchGroupDto, MatchGroupStatus } from '@logix/shared';
import { Layers, Sparkles, Box, AlertCircle, Clock } from 'lucide-react';

export default function MatchGroupsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const queryUrl =
    statusFilter === 'ALL'
      ? '/match-groups'
      : `/match-groups?status=${statusFilter}`;

  const { data, isLoading, error } = useQuery<{ items: MatchGroupDto[] }>({
    queryKey: ['match-groups', 'page', statusFilter],
    queryFn: () => fetchApi<{ items: MatchGroupDto[] }>(queryUrl),
    staleTime: 5000,
  });

  const proposeMutation = useMutation({
    mutationFn: () =>
      fetchApi<{ success: boolean; proposalsCount: number }>('/match-groups/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['match-groups'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setActionMessage(`Thuật toán đã tạo ${res.proposalsCount} kế hoạch đóng ghép mới!`);
      setTimeout(() => setActionMessage(null), 5000);
    },
    onError: (err: any) => {
      setActionMessage(`Lỗi chạy thuật toán: ${err.message}`);
      setTimeout(() => setActionMessage(null), 5000);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/match-groups/${id}/confirm`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-groups'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setActionMessage('Đã chốt kế hoạch đóng ghép cont thành công!');
      setTimeout(() => setActionMessage(null), 5000);
    },
    onError: (err: any) => {
      setActionMessage(`Lỗi: ${err.message}`);
      setTimeout(() => setActionMessage(null), 5000);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/match-groups/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-groups'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setActionMessage('Đã hủy nhóm ghép cont, lô hàng được hoàn lại hàng đợi gom.');
      setTimeout(() => setActionMessage(null), 5000);
    },
    onError: (err: any) => {
      setActionMessage(`Lỗi: ${err.message}`);
      setTimeout(() => setActionMessage(null), 5000);
    },
  });

  const groups = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Kế Hoạch Ghép Hàng LCL & Container (Consolidation)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Tổng hợp các lô hàng cùng tuyến, tự động tính toán dung tích vỏ cont và tối ưu phân bổ tải trọng.
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

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        {[
          { label: 'Tất cả', value: 'ALL' },
          { label: 'Đang đề xuất', value: MatchGroupStatus.PROPOSED },
          { label: 'Đã chốt ghép', value: MatchGroupStatus.CONFIRMED },
          { label: 'Đã hủy', value: MatchGroupStatus.CANCELLED },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              statusFilter === tab.value
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-500 text-sm">Đang tải danh sách nhóm ghép...</div>
        ) : error ? (
          <div className="py-16 text-center text-red-400 text-sm">Lỗi tải dữ liệu: {(error as any).message}</div>
        ) : groups.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Layers className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-white">Chưa có kế hoạch ghép container nào</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Không tìm thấy nhóm consol phù hợp bộ lọc. Hãy nhấn &quot;Đề xuất ghép hàng tự động&quot; để thuật toán gom các lô hàng đang chờ.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-900/80">
                  <th className="py-3.5 px-4">Mã Kế Hoạch</th>
                  <th className="py-3.5 px-4">Tuyến Vận Tải</th>
                  <th className="py-3.5 px-4">Loại Container</th>
                  <th className="py-3.5 px-4">Số Lô Hàng</th>
                  <th className="py-3.5 px-4">Độ Lấp Đầy Thể Tích</th>
                  <th className="py-3.5 px-4">Tải Trọng Hàng</th>
                  <th className="py-3.5 px-4">Hạn Chốt Ghép</th>
                  <th className="py-3.5 px-4">Trạng Thái</th>
                  <th className="py-3.5 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {groups.map((g) => {
                  const volRate = g.volumeFillRate;
                  return (
                    <tr key={g.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        <Link href={`/match-groups/${g.id}`} className="hover:text-blue-400 flex items-center gap-1.5">
                          {g.code}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-200">
                        {g.lane ? (
                          <div>
                            <div className="font-semibold text-white">{g.lane.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {g.lane.origin} → {g.lane.destination}
                            </div>
                          </div>
                        ) : (
                          g.laneId
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-slate-200">
                          <Box className="h-3.5 w-3.5 text-blue-400" />
                          {g.targetContainerType?.code} ({g.targetContainerType?.volumeCbm} m³)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-medium">
                        {g.shipmentCount} lô hàng
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="w-36">
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-white font-semibold">{volRate}%</span>
                            <span className="text-slate-400">{g.totalCbm} m³</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${
                                volRate > 80 ? 'bg-emerald-500' : volRate > 50 ? 'bg-blue-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(volRate, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="w-36">
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-white font-semibold">{g.weightFillRate}%</span>
                            <span className="text-slate-400">{g.totalWeightKg} kg</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-2 rounded-full bg-indigo-500"
                              style={{ width: `${Math.min(g.weightFillRate, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {g.cutoffTime ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-500" />
                            {new Date(g.cutoffTime).toLocaleDateString('vi-VN')}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold border ${
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
                      <td className="py-3.5 px-4 text-right space-x-2">
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
