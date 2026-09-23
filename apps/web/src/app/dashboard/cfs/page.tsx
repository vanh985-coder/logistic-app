'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import {
  Warehouse,
  PackageCheck,
  ShieldCheck,
  Boxes,
  Truck,
  ArrowRight,
  Camera,
  Layers,
  MapPin,
} from 'lucide-react';
import { Card, StatusBadge, EmptyState } from '@/components/ui';

interface CfsMetrics {
  waitingConsolidations: number;
  tallyPendingShipments: number;
  sealedContainers: number;
  totalPackagesHandled: number;
}

export default function CfsWarehouseDashboardPage() {
  const { data: metrics, isLoading: isMetricsLoading } = useQuery<CfsMetrics>({
    queryKey: ['cfs', 'metrics'],
    queryFn: () => fetchApi<CfsMetrics>('/cfs/metrics'),
    staleTime: 5000,
  });

  const { data: tasks, isLoading: isTasksLoading } = useQuery<any[]>({
    queryKey: ['cfs', 'tasks'],
    queryFn: () => fetchApi<any[]>('/cfs/tasks'),
    staleTime: 5000,
  });

  return (
    <div className="space-y-6 font-sans pb-16 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Mobile-Friendly Touch Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/20 text-primary-light flex items-center justify-center shrink-0 border border-primary/30">
            <Warehouse className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400">
              Chế độ vận hành hiện trường kho bãi
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Bảng Điều Khiển Kho CFS
            </h1>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 mt-2">
          Giao diện Touch-First tối ưu cho thiết bị di động & máy tính bảng tại cửa kho. Kiểm đếm số kiện thực nhận, đối chiếu 3D và niêm chì container.
        </p>
      </div>

      {/* 4 Touch-First Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Chờ nhận hàng
            </span>
            <Truck className="h-5 w-5 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-600 font-mono-numeric">
            {isMetricsLoading ? '...' : metrics?.waitingConsolidations ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Container đã chốt booking</div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Lô chờ kiểm đếm
            </span>
            <PackageCheck className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-blue-600 font-mono-numeric">
            {isMetricsLoading ? '...' : metrics?.tallyPendingShipments ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Lô hàng đang nhập kho</div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Đã niêm chì
            </span>
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-600 font-mono-numeric">
            {isMetricsLoading ? '...' : metrics?.sealedContainers ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Container sẵn sàng xuất bến</div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Tổng kiện đã xử lý
            </span>
            <Boxes className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-indigo-600 font-mono-numeric">
            {isMetricsLoading ? '...' : (metrics?.totalPackagesHandled ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Kiện hàng qua cổng kho</div>
        </div>
      </div>

      {/* Task List - Touch Friendly Big Cards (No dense tables) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Nhiệm Vụ Kiểm Đếm & Đóng Ghép Container Tại Kho
          </h2>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
            {tasks?.length || 0} container
          </span>
        </div>

        {isTasksLoading ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
            <p className="text-xs text-slate-500">Đang tải danh sách nhiệm vụ kho...</p>
          </div>
        ) : tasks && tasks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tasks.map((task: any) => {
              const mg = task.matchGroup;
              const isSealed = task.status === 'SEALED';
              const pendingTallyCount = mg.matchGroupShipments.filter(
                (mgs: any) => mgs.tallyStatus === 'PENDING',
              ).length;
              const proofCount = task.loadingProofs?.length || 0;

              return (
                <div
                  key={task.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between hover:border-primary/50 transition-all"
                >
                  <div>
                    {/* Header line */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-bold rounded-lg font-mono">
                          {mg.code}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          {task.bookingNumber}
                        </span>
                      </div>
                      <StatusBadge status={task.status} />
                    </div>

                    {/* Route & Container Info */}
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
                      <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{mg.lane?.name || mg.laneId}</span>
                      <span className="text-slate-400 font-normal">|</span>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                        {mg.targetContainerType?.code || '40HC'}
                      </span>
                    </div>

                    {/* Logistics metadata */}
                    <div className="grid grid-cols-2 gap-2 my-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 block">Số chủ hàng / Lô:</span>
                        <span className="font-semibold text-slate-700">
                          {mg.matchGroupShipments.length} lô hàng
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Tiến độ kiểm đếm:</span>
                        <span
                          className={`font-semibold ${
                            pendingTallyCount === 0 ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        >
                          {pendingTallyCount === 0
                            ? '✓ Đã kiểm 100%'
                            : `Còn ${pendingTallyCount} lô chờ`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Ảnh nghiệm thu:</span>
                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                          <Camera className="h-3.5 w-3.5 text-slate-400" />
                          {proofCount} ảnh đã chụp
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Niêm chì cont:</span>
                        <span className="font-semibold text-slate-700 font-mono">
                          {task.sealNo ? `Seal: ${task.sealNo}` : 'Chưa niêm phong'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Primary Touch Action Button (Min 48px height) */}
                  <Link
                    href={`/cfs/operations/${task.id}`}
                    className="mt-2 min-h-[50px] w-full flex items-center justify-center gap-2 rounded-xl font-bold text-sm bg-primary text-white hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md"
                  >
                    <span>{isSealed ? 'XEM KẾT QUẢ NGHIỆM THU' : 'VÀO KIỂM ĐẾM & ĐÓNG CONT'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="p-8 bg-white border border-slate-200 text-center rounded-2xl">
            <EmptyState
              icon={<Warehouse className="h-10 w-10 text-primary" />}
              title="Hiện tại chưa có nhóm ghép nào cần xử lý"
              description="Khi Forwarder chốt booking cho nhóm hàng tại kho của bạn, nhiệm vụ sẽ tự động xuất hiện tại đây."
              actionLabel="Xem chi tiết nhóm ghép"
              onAction={() => (window.location.href = '/match-groups')}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
