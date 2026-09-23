'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import { MatchGroupDto, MatchGroupStatus } from '@logix/shared';
import { Layers, Sparkles, Box, AlertCircle, Clock, X } from 'lucide-react';
import { Button, StatusBadge, Card, EmptyState } from '@/components/ui';
import { useAuth } from '@/contexts/auth-context';

export default function MatchGroupsPage() {
  const { user } = useAuth();
  const canManageGroup =
    user?.role === 'FWD_ADMIN' ||
    user?.role === 'FWD_OPERATOR' ||
    user?.role === 'PLATFORM_ADMIN' ||
    user?.role === 'ADMIN';
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
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-title flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Layers className="h-5 w-5" />
            </div>
            Kế Hoạch Ghép Hàng LCL & Container
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Gom các lô hàng cùng tuyến, tối ưu tỷ lệ lấp đầy thể tích CBM và phân bổ tải trọng container
          </p>
        </div>

        {canManageGroup && (
          <Button
            variant="primary"
            size="md"
            onClick={() => proposeMutation.mutate()}
            isLoading={proposeMutation.isPending}
            leftIcon={<Sparkles className="h-4 w-4" />}
          >
            {proposeMutation.isPending ? 'Đang chạy thuật toán...' : 'Đề xuất ghép hàng tự động'}
          </Button>
        )}
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-primary text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-text-secondary hover:text-title">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { label: 'Tất cả', value: 'ALL' },
          { label: 'Đang đề xuất', value: MatchGroupStatus.PROPOSED },
          { label: 'Đã chốt ghép', value: MatchGroupStatus.CONFIRMED },
          { label: 'Đã hủy', value: MatchGroupStatus.CANCELLED },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3.5 py-1.5 rounded-xl font-medium transition cursor-pointer whitespace-nowrap ${
              statusFilter === tab.value
                ? 'bg-primary text-white shadow-sm shadow-primary/20'
                : 'bg-surface-card border border-border-input text-text-secondary hover:bg-surface-hover hover:text-title'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Table Card */}
      <Card className="overflow-hidden bg-surface-card border-border-subtle shadow-sm">
        {isLoading ? (
          <div className="py-16 text-center text-text-secondary text-sm">Đang tải danh sách nhóm ghép...</div>
        ) : error ? (
          <div className="py-16 text-center text-rose-600 text-sm">Lỗi tải dữ liệu: {(error as any).message}</div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-7 w-7 text-primary" />}
            title="Chưa có kế hoạch ghép container nào"
            description="Không tìm thấy nhóm consol phù hợp bộ lọc. Hãy nhấn 'Đề xuất ghép hàng tự động' để thuật toán gom các lô hàng đang chờ."
            actionLabel="Đề xuất ghép hàng ngay"
            onAction={() => proposeMutation.mutate()}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-surface-app border-b border-border-subtle text-text-secondary uppercase text-[11px] font-semibold whitespace-nowrap">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Mã Kế Hoạch</th>
                  <th className="py-3.5 px-4">Tuyến Vận Tải</th>
                  <th className="py-3.5 px-4">Loại Container</th>
                  <th className="py-3.5 px-4 text-center">Số Lô Hàng</th>
                  <th className="py-3.5 px-4">Lấp Đầy Thể Tích</th>
                  <th className="py-3.5 px-4">Tải Trọng Hàng</th>
                  <th className="py-3.5 px-4">Hạn Chốt Ghép</th>
                  <th className="py-3.5 px-4 text-center">Trạng Thái</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {groups.map((g) => {
                  const volRate = g.volumeFillRate;
                  return (
                    <tr key={g.id} className="hover:bg-surface-app transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 font-mono-numeric font-bold text-title">
                        <Link href={`/match-groups/${g.id}`} className="hover:text-primary transition flex items-center gap-1.5">
                          {g.code}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-body">
                        {g.lane ? (
                          <div>
                            <div className="font-semibold text-title">{g.lane.name}</div>
                            <div className="text-[11px] text-text-secondary font-mono-numeric">
                              {g.lane.origin} → {g.lane.destination}
                            </div>
                          </div>
                        ) : (
                          g.laneId
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-subtle border border-border-subtle font-mono-numeric text-[11px] font-medium text-title">
                          <Box className="h-3.5 w-3.5 text-primary" />
                          {g.targetContainerType?.code} ({g.targetContainerType?.volumeCbm} m³)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono-numeric font-medium text-body">
                        {g.shipmentCount} lô
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="w-36">
                          <div className="flex justify-between text-[11px] mb-1 font-mono-numeric">
                            <span className="text-title font-bold">{volRate}%</span>
                            <span className="text-text-secondary">{g.totalCbm} m³</span>
                          </div>
                          <div className="w-full bg-border-subtle rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                volRate > 80 ? 'bg-emerald-500' : volRate > 50 ? 'bg-primary' : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(volRate, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="w-36">
                          <div className="flex justify-between text-[11px] mb-1 font-mono-numeric">
                            <span className="text-title font-bold">{g.weightFillRate}%</span>
                            <span className="text-text-secondary">{g.totalWeightKg} kg</span>
                          </div>
                          <div className="w-full bg-border-subtle rounded-full h-2 overflow-hidden">
                            <div
                              className="h-2 rounded-full bg-indigo-500 transition-all duration-300"
                              style={{ width: `${Math.min(g.weightFillRate, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-text-secondary font-mono-numeric">
                        {g.cutoffTime ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3 text-text-muted" />
                            {new Date(g.cutoffTime).toLocaleDateString('vi-VN')}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={g.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right space-x-2 whitespace-nowrap">
                        <Link href={`/match-groups/${g.id}`}>
                          <Button variant="outline" size="sm">Chi tiết</Button>
                        </Link>
                        {canManageGroup && g.status === 'PROPOSED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => confirmMutation.mutate(g.id)}
                            isLoading={confirmMutation.isPending}
                          >
                            Chốt ghép
                          </Button>
                        )}
                        {canManageGroup && (g.status === 'PROPOSED' || g.status === 'CONFIRMED') && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => cancelMutation.mutate(g.id)}
                            isLoading={cancelMutation.isPending}
                          >
                            Hủy
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
