'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import { MatchGroupDto } from '@logix/shared';
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  XCircle,
  Layers,
  FileText,
  AlertCircle,
  X,
} from 'lucide-react';
import { Button, StatusBadge, Card } from '@/components/ui';
import { PackingViewer3D } from '@/components/packing/PackingViewer3D';
import { MatchGroupQuotesSection } from '@/components/quoting/MatchGroupQuotesSection';
import { useAuth } from '@/contexts/auth-context';

export default function MatchGroupDetailPage() {
  const { user } = useAuth();
  const canManageGroup =
    user?.role === 'FWD_ADMIN' ||
    user?.role === 'FWD_OPERATOR' ||
    user?.role === 'PLATFORM_ADMIN' ||
    user?.role === 'ADMIN';
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const { data: group, isLoading, error } = useQuery<MatchGroupDto>({
    queryKey: ['match-groups', id],
    queryFn: () => fetchApi<MatchGroupDto>(`/match-groups/${id}`),
  });

  const confirmMutation = useMutation({
    mutationFn: () => fetchApi(`/match-groups/${id}/confirm`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-groups', id] });
      queryClient.invalidateQueries({ queryKey: ['match-groups'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setActionMessage('Đã xác nhận chốt kế hoạch đóng cont thành công!');
      setTimeout(() => setActionMessage(null), 5000);
    },
    onError: (err: any) => {
      setActionMessage(`Lỗi chốt kế hoạch: ${err.message}`);
      setTimeout(() => setActionMessage(null), 5000);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => fetchApi(`/match-groups/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-groups', id] });
      queryClient.invalidateQueries({ queryKey: ['match-groups'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setActionMessage('Đã hủy nhóm ghép cont, các lô hàng đã được chuyển về hàng đợi.');
      setTimeout(() => setActionMessage(null), 5000);
    },
    onError: (err: any) => {
      setActionMessage(`Lỗi: ${err.message}`);
      setTimeout(() => setActionMessage(null), 5000);
    },
  });

  if (isLoading) {
    return (
      <div className="py-24 text-center text-text-secondary text-sm font-sans">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-3" />
        Đang tải thông tin chi tiết kế hoạch ghép container...
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="py-24 text-center text-rose-600 text-sm font-sans">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-rose-500" />
        {(error as any)?.message || 'Không tìm thấy kế hoạch ghép hàng yêu cầu.'}
        <div className="mt-4">
          <Link href="/match-groups">
            <Button variant="outline" size="sm">Quay lại danh sách</Button>
          </Link>
        </div>
      </div>
    );
  }

  const container = group.targetContainerType;
  const volRate = group.volumeFillRate;
  const weightRate = group.weightFillRate;

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <Link href="/match-groups">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Danh sách
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold tracking-tight text-title font-mono-numeric">
                {group.code}
              </h1>
              <StatusBadge status={group.status} />
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Khởi tạo: {new Date(group.createdAt).toLocaleString('vi-VN')}
            </p>
          </div>
        </div>

        {/* Action buttons (FWD and Admin only) */}
        {canManageGroup && (
          <div className="flex items-center gap-3">
            {group.status === 'PROPOSED' && (
              <Button
                variant="primary"
                size="md"
                onClick={() => confirmMutation.mutate()}
                isLoading={confirmMutation.isPending}
                leftIcon={<CheckCircle2 className="h-4 w-4" />}
              >
                Chốt kế hoạch đóng cont
              </Button>
            )}

            {(group.status === 'PROPOSED' || group.status === 'CONFIRMED') && (
              <Button
                variant="danger"
                size="md"
                onClick={() => cancelMutation.mutate()}
                isLoading={cancelMutation.isPending}
                leftIcon={<XCircle className="h-4 w-4" />}
              >
                Hủy nhóm ghép
              </Button>
            )}
          </div>
        )}
      </div>

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

      {/* Grid Overview: Container Spec + Utilization Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Container Specs Card */}
        <Card className="p-5 bg-surface-card border-border-subtle shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-title uppercase tracking-wider flex items-center gap-2">
              <Box className="h-4 w-4 text-primary" />
              Thông Số Vỏ Container & Tuyến
            </h2>
            <span className="font-mono-numeric text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-primary border border-blue-200">
              {container?.code}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-surface-app rounded-xl border border-border-subtle">
              <div className="text-text-secondary">Tuyến vận chuyển</div>
              <div className="text-title font-bold mt-1">
                {group.lane ? group.lane.name : group.laneId}
              </div>
              <div className="text-text-muted font-mono-numeric text-[11px] mt-0.5">
                {group.lane?.origin} → {group.lane?.destination}
              </div>
            </div>

            <div className="p-3.5 bg-surface-app rounded-xl border border-border-subtle">
              <div className="text-text-secondary">Kích thước lòng cont</div>
              <div className="text-title font-bold font-mono-numeric mt-1">
                {container?.innerLengthMm} × {container?.innerWidthMm} × {container?.innerHeightMm}
              </div>
              <div className="text-text-muted text-[11px] mt-0.5">Dài × Rộng × Cao (mm)</div>
            </div>

            <div className="p-3.5 bg-surface-app rounded-xl border border-border-subtle">
              <div className="text-text-secondary">Thể tích chứa tối đa</div>
              <div className="text-emerald-600 font-extrabold text-base font-mono-numeric mt-0.5">
                {container?.volumeCbm} m³
              </div>
              <div className="text-text-muted text-[10px]">Dung tích thiết kế tiêu chuẩn</div>
            </div>

            <div className="p-3.5 bg-surface-app rounded-xl border border-border-subtle">
              <div className="text-text-secondary">Tải trọng hàng tối đa</div>
              <div className="text-indigo-600 font-extrabold text-base font-mono-numeric mt-0.5">
                {container?.maxPayloadKg.toLocaleString()} kg
              </div>
              <div className="text-text-muted text-[10px]">Tự trọng vỏ: {container?.tareWeightKg.toLocaleString()} kg</div>
            </div>
          </div>
        </Card>

        {/* Utilization Gauges Card */}
        <Card className="p-5 bg-surface-card border-border-subtle shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-title uppercase tracking-wider flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-600" />
            Độ Lấp Đầy & Hiệu Suất Tải Trọng
          </h2>

          <div className="space-y-4 pt-1">
            {/* Volume gauge */}
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-mono-numeric">
                <span className="text-body font-medium">Lấp đầy thể tích (Volume Fill):</span>
                <span className="text-title font-bold">
                  {volRate}% ({group.totalCbm} / {container?.volumeCbm} m³)
                </span>
              </div>
              <div className="w-full bg-border-subtle rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    volRate > 80 ? 'bg-emerald-500' : volRate > 50 ? 'bg-primary' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(volRate, 100)}%` }}
                />
              </div>
            </div>

            {/* Weight gauge */}
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-mono-numeric">
                <span className="text-body font-medium">Lấp đầy tải trọng (Payload Fill):</span>
                <span className="text-title font-bold">
                  {weightRate}% ({group.totalWeightKg.toLocaleString()} / {container?.maxPayloadKg.toLocaleString()} kg)
                </span>
              </div>
              <div className="w-full bg-border-subtle rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${Math.min(weightRate, 100)}%` }}
                />
              </div>
            </div>

            {volRate > 85 && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Hiệu suất thể tích rất cao (&gt;85%), đạt chuẩn tối ưu chi phí vận chuyển LCL quốc tế.</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 3D Container Simulation Viewport Container (Deliberate Dark Background Exception) */}
      <PackingViewer3D matchGroup={group} />

      {/* Quoting & Cost Allocation Section */}
      <MatchGroupQuotesSection
        matchGroupId={group.id}
        matchGroupStatus={group.status}
        shipments={group.shipments || []}
      />

      {/* Shipments inside this Consol Group */}
      <Card className="overflow-hidden bg-surface-card border-border-subtle shadow-sm">
        <div className="p-5 border-b border-border-subtle flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-title flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Danh Sách Lô Hàng Đóng Ghép ({group.shipmentCount} lô)
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Các lô hàng lẻ LCL từ nhiều chủ hàng khác nhau được gom chung vào vỏ container này.
            </p>
          </div>
        </div>

        {(!group.shipments || group.shipments.length === 0) ? (
          <div className="py-12 text-center text-text-secondary text-xs">
            Chưa có lô hàng nào trong kế hoạch này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-surface-app border-b border-border-subtle text-text-secondary uppercase text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-4 sm:px-6">Mã Vận Đơn</th>
                  <th className="py-3 px-4">Chủ Hàng (Shipper)</th>
                  <th className="py-3 px-4 text-center">Số Kiện</th>
                  <th className="py-3 px-4 text-right">Thể Tích (CBM)</th>
                  <th className="py-3 px-4 text-right">Khối Lượng (kg)</th>
                  <th className="py-3 px-4">Cơ Sở Tính Cước</th>
                  <th className="py-3 px-4 text-right">Cước Tạm Tính</th>
                  <th className="py-3 px-4 text-center">Trạng Thái</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {group.shipments.map((m) => {
                  const s = m.shipment;
                  if (!s) return null;
                  return (
                    <tr key={m.id} className="hover:bg-surface-app transition-colors">
                      <td className="py-3 px-4 sm:px-6 font-mono-numeric font-bold text-title">
                        <Link href={`/shipments/${s.id}`} className="hover:text-primary transition">
                          {s.trackingCode}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-title">{s.company?.name || 'Chủ hàng'}</div>
                        <div className="text-[11px] text-text-secondary font-mono-numeric">MST: {s.company?.taxCode || '—'}</div>
                      </td>
                      <td className="py-3 px-4 text-center text-body font-mono-numeric font-medium">
                        {s.totalPackages}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-numeric text-body font-medium">
                        {s.volumeCbm} m³
                      </td>
                      <td className="py-3 px-4 text-right font-mono-numeric text-body font-medium">
                        {Number(s.weightKg).toLocaleString()} kg
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-surface-app border border-border-subtle text-[10px] font-semibold text-text-secondary">
                          {s.chargeableBasis === 'VOLUME' ? 'Thể tích (CBM)' : 'Khối lượng (Kg)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-numeric text-emerald-600 font-bold text-sm">
                        {Number(s.totalAmount).toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={s.status} size="sm" />
                      </td>
                      <td className="py-3 px-4 sm:px-6 text-right">
                        <Link href={`/shipments/${s.id}`}>
                          <Button variant="outline" size="sm">Xem kiện</Button>
                        </Link>
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
