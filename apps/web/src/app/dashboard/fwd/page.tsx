'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import { MatchGroupDto } from '@logix/shared';
import { Layers, ArrowRight, Sparkles, Box, AlertCircle, LayoutDashboard, X } from 'lucide-react';
import { Button, StatusBadge, Card, EmptyState } from '@/components/ui';

interface MatchGroupStats {
  totalMatchGroups: number;
  activeMatchGroups: number;
  totalGroupedShipments: number;
  totalGroupedCbm: string;
  totalGroupedWeightKg: string;
  avgVolumeFillRate: number;
  avgWeightFillRate: number;
}

interface FwdMetrics {
  availableGroupsCount: number;
  myQuotesCount: number;
  activeBookingsCount: number;
  totalCbmConsolidated: string;
  totalCbmMm3: string;
}

export default function ForwarderDashboardPage() {
  const queryClient = useQueryClient();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const { data: stats, isLoading: isStatsLoading } = useQuery<MatchGroupStats>({
    queryKey: ['match-groups', 'stats'],
    queryFn: () => fetchApi<MatchGroupStats>('/match-groups/stats'),
    staleTime: 5000,
  });

  const { data: fwdMetrics, isLoading: isMetricsLoading } = useQuery<FwdMetrics>({
    queryKey: ['match-groups', 'fwd-metrics'],
    queryFn: () => fetchApi<FwdMetrics>('/match-groups/fwd-metrics'),
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
    <div className="space-y-6 font-sans pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-title flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            Bảng Điều Khiển Giao Nhận Vận Tải (Forwarder)
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Lập kế hoạch đóng ghép container LCL, tối ưu tỷ lệ lấp đầy thể tích và phân bổ tải trọng axle load.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => proposeMutation.mutate()}
          isLoading={proposeMutation.isPending}
          leftIcon={<Sparkles className="h-4 w-4" />}
        >
          {proposeMutation.isPending ? 'Đang chạy thuật toán...' : 'Đề xuất ghép hàng tự động'}
        </Button>
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

      {/* Real Statistics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 bg-surface-card border-border-subtle shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Nhóm Chờ Báo Giá
          </div>
          <div className="mt-2 text-3xl font-extrabold text-title font-mono-numeric">
            {isMetricsLoading && isStatsLoading
              ? '...'
              : (fwdMetrics?.availableGroupsCount ?? stats?.activeMatchGroups ?? 0)}
          </div>
          <div className="mt-1 text-xs text-text-muted">Container đang chờ FWD chào giá</div>
        </Card>

        <Card className="p-5 bg-surface-card border-border-subtle shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Báo Giá Của Bạn
          </div>
          <div className="mt-2 text-3xl font-extrabold text-indigo-600 font-mono-numeric">
            {isMetricsLoading ? '...' : (fwdMetrics?.myQuotesCount ?? 0)}
          </div>
          <div className="mt-1 text-xs text-text-muted">Báo giá FWD đã gửi cho nhóm gom</div>
        </Card>

        <Card className="p-5 bg-surface-card border-border-subtle shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Booking Đang Vận Hành
          </div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-600 font-mono-numeric">
            {isMetricsLoading ? '...' : (fwdMetrics?.activeBookingsCount ?? 0)}
          </div>
          <div className="mt-1 text-xs text-text-muted">Container đã chốt booking vận tải</div>
        </Card>

        <Card className="p-5 bg-surface-card border-border-subtle shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Tổng Khối Tích Gom
          </div>
          <div className="mt-2 text-3xl font-extrabold text-amber-600 font-mono-numeric">
            {isMetricsLoading && isStatsLoading
              ? '...'
              : `${Number(fwdMetrics?.totalCbmConsolidated || 0).toFixed(2)} m³`}
          </div>
          <div className="mt-1 text-xs text-text-muted">
            Lấp đầy TB: <span className="font-semibold text-body">{stats?.avgVolumeFillRate ?? 0}%</span>
          </div>
        </Card>
      </div>

      {/* Match Groups List Card */}
      <Card className="p-6 bg-surface-card border-border-subtle shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-title flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Kế Hoạch Đóng Ghép Container Đang Thực Hiện
          </h2>
          <Link
            href="/match-groups"
            className="text-xs text-primary hover:text-primary-hover font-semibold inline-flex items-center gap-1 transition"
          >
            Xem tất cả <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {isGroupsLoading ? (
          <div className="py-12 text-center text-text-secondary text-sm">Đang tải danh sách nhóm ghép...</div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-7 w-7 text-primary" />}
            title="Chưa có kế hoạch đóng ghép container nào"
            description="Nhấn nút 'Đề xuất ghép hàng tự động' phía trên để thuật toán tự động quét các lô hàng đã gửi và tối ưu container."
            actionLabel="Đề xuất ghép hàng ngay"
            onAction={() => proposeMutation.mutate()}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-surface-app text-text-secondary uppercase text-[11px] font-semibold border-b border-border-subtle">
                <tr>
                  <th className="py-3 px-4">Mã Nhóm</th>
                  <th className="py-3 px-4">Tuyến Vận Chuyển</th>
                  <th className="py-3 px-4">Vỏ Container</th>
                  <th className="py-3 px-4 text-center">Số Lô Hàng</th>
                  <th className="py-3 px-4">Lấp Đầy Thể Tích</th>
                  <th className="py-3 px-4">Tải Trọng</th>
                  <th className="py-3 px-4 text-center">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {groups.map((g) => {
                  const volRate = g.volumeFillRate;
                  return (
                    <tr key={g.id} className="hover:bg-surface-app transition-colors">
                      <td className="py-3 px-4 font-mono-numeric font-bold text-title">
                        <Link href={`/match-groups/${g.id}`} className="hover:text-primary transition">
                          {g.code}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-body font-medium">
                        {g.lane ? `${g.lane.origin} → ${g.lane.destination}` : g.laneId}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-surface-subtle border border-border-subtle font-mono-numeric text-[11px] font-medium text-title">
                          <Box className="h-3 w-3 text-primary" />
                          {g.targetContainerType?.code || 'Cont'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono-numeric font-medium text-body">
                        {g.shipmentCount} lô
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-32">
                          <div className="flex justify-between text-[11px] mb-1 font-mono-numeric">
                            <span className="text-title font-bold">{volRate}%</span>
                            <span className="text-text-secondary">{g.totalCbm} m³</span>
                          </div>
                          <div className="w-full bg-border-subtle rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                volRate > 80 ? 'bg-emerald-500' : volRate > 50 ? 'bg-primary' : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(volRate, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-32">
                          <div className="flex justify-between text-[11px] mb-1 font-mono-numeric">
                            <span className="text-title font-bold">{g.weightFillRate}%</span>
                            <span className="text-text-secondary">{g.totalWeightKg} kg</span>
                          </div>
                          <div className="w-full bg-border-subtle rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                              style={{ width: `${Math.min(g.weightFillRate, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={g.status} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <Link href={`/match-groups/${g.id}`}>
                          <Button variant="outline" size="sm">Chi tiết</Button>
                        </Link>
                        {g.status === 'PROPOSED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => confirmMutation.mutate(g.id)}
                            isLoading={confirmMutation.isPending}
                          >
                            Chốt ghép
                          </Button>
                        )}
                        {(g.status === 'PROPOSED' || g.status === 'CONFIRMED') && (
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
