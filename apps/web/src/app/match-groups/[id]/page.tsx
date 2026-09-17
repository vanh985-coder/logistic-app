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
  CheckCircle,
  XCircle,
  Layers,
  FileText,
  AlertCircle,
} from 'lucide-react';

export default function MatchGroupDetailPage() {
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
      <div className="py-24 text-center text-slate-400 text-sm">
        Đang tải thông tin chi tiết kế hoạch ghép container...
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="py-24 text-center text-red-400 text-sm">
        {(error as any)?.message || 'Không tìm thấy kế hoạch ghép hàng yêu cầu.'}
        <div className="mt-4">
          <Link href="/match-groups" className="text-blue-400 hover:underline text-xs">
            Quay lại danh sách kế hoạch
          </Link>
        </div>
      </div>
    );
  }

  const container = group.targetContainerType;
  const volRate = group.volumeFillRate;
  const weightRate = group.weightFillRate;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/match-groups"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold tracking-tight text-white font-mono">
                {group.code}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
                  group.status === 'PROPOSED'
                    ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                    : group.status === 'CONFIRMED'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {group.status === 'PROPOSED'
                  ? 'Đang đề xuất'
                  : group.status === 'CONFIRMED'
                  ? 'Đã chốt kế hoạch'
                  : group.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Khởi tạo ngày: {new Date(group.createdAt).toLocaleString('vi-VN')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {group.status === 'PROPOSED' && (
            <button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer shadow-sm shadow-emerald-500/20"
            >
              <CheckCircle className="h-4 w-4" />
              Chốt kế hoạch đóng cont
            </button>
          )}

          {(group.status === 'PROPOSED' || group.status === 'CONFIRMED') && (
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 text-xs font-semibold transition cursor-pointer"
            >
              <XCircle className="h-4 w-4" />
              Hủy nhóm ghép
            </button>
          )}
        </div>
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

      {/* Grid Overview: Container Spec + Utilization Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Container Specs Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Box className="h-4 w-4 text-blue-400" />
              Thông Số Vỏ Container & Tuyến
            </h2>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
              {container?.code}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div className="text-slate-400">Tuyến vận chuyển</div>
              <div className="text-white font-semibold mt-1">
                {group.lane ? group.lane.name : group.laneId}
              </div>
              <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                {group.lane?.origin} → {group.lane?.destination}
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div className="text-slate-400">Kích thước lòng cont</div>
              <div className="text-white font-semibold font-mono mt-1">
                {container?.innerLengthMm} × {container?.innerWidthMm} × {container?.innerHeightMm} mm
              </div>
              <div className="text-slate-500 text-[11px] mt-0.5">Dài × Rộng × Cao</div>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div className="text-slate-400">Thể tích chứa tối đa</div>
              <div className="text-emerald-400 font-extrabold text-base font-mono mt-0.5">
                {container?.volumeCbm} m³
              </div>
              <div className="text-slate-500 text-[10px]">Dung tích thiết kế tiêu chuẩn</div>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div className="text-slate-400">Tải trọng hàng tối đa</div>
              <div className="text-indigo-400 font-extrabold text-base font-mono mt-0.5">
                {container?.maxPayloadKg.toLocaleString()} kg
              </div>
              <div className="text-slate-500 text-[10px]">Tự trọng vỏ: {container?.tareWeightKg.toLocaleString()} kg</div>
            </div>
          </div>
        </div>

        {/* Utilization Gauges Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-400" />
            Độ Lấp Đầy & Hiệu Suất Tải Trọng
          </h2>

          <div className="space-y-4 pt-1">
            {/* Volume gauge */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Lấp đầy thể tích (Volume Fill):</span>
                <span className="text-white font-bold font-mono">
                  {volRate}% ({group.totalCbm} / {container?.volumeCbm} m³)
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    volRate > 80 ? 'bg-emerald-500' : volRate > 50 ? 'bg-blue-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(volRate, 100)}%` }}
                />
              </div>
            </div>

            {/* Weight gauge */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Lấp đầy tải trọng (Payload Fill):</span>
                <span className="text-white font-bold font-mono">
                  {weightRate}% ({group.totalWeightKg.toLocaleString()} / {container?.maxPayloadKg.toLocaleString()} kg)
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800">
                <div
                  className="h-2 rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${Math.min(weightRate, 100)}%` }}
                />
              </div>
            </div>

            {volRate > 85 && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>Hiệu suất thể tích rất cao (&gt;85%), đạt chuẩn tối ưu chi phí vận chuyển LCL quốc tế.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shipments inside this Consol Group */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-400" />
              Danh Sách Lô Hàng Đóng Ghép ({group.shipmentCount} lô)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Các lô hàng lẻ LCL từ nhiều chủ hàng khác nhau được gom chung vào vỏ container này.
            </p>
          </div>
        </div>

        {(!group.shipments || group.shipments.length === 0) ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            Chưa có lô hàng nào trong kế hoạch này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-900/60">
                  <th className="py-3 px-4">Mã Vận Đơn</th>
                  <th className="py-3 px-4">Chủ Hàng (Shipper)</th>
                  <th className="py-3 px-4 text-center">Số Kiện</th>
                  <th className="py-3 px-4 text-right">Thể Tích (CBM)</th>
                  <th className="py-3 px-4 text-right">Khối Lượng (kg)</th>
                  <th className="py-3 px-4">Căn Cứ Tính Cước</th>
                  <th className="py-3 px-4 text-right">Cước Tạm Tính (VNĐ)</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {group.shipments.map((m) => {
                  const s = m.shipment;
                  if (!s) return null;
                  return (
                    <tr key={m.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        <Link href={`/shipments/${s.id}`} className="hover:text-blue-400">
                          {s.trackingCode}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-200">{s.company?.name || 'Chủ hàng'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">MST: {s.company?.taxCode || '—'}</div>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-300 font-mono">
                        {s.totalPackages}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400 font-semibold">
                        {s.volumeCbm} m³
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-indigo-400 font-semibold">
                        {Number(s.weightKg).toLocaleString()} kg
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono">
                          {s.chargeableBasis === 'VOLUME' ? 'Thể tích (CBM)' : 'Khối lượng (Kg)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-white font-bold">
                        {Number(s.totalAmount).toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-950/60 text-blue-300 border border-blue-800 font-mono">
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/shipments/${s.id}`}
                          className="px-2.5 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        >
                          Xem kiện
                        </Link>
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
