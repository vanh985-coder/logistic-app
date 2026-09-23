'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import { useAuth } from '@/contexts/auth-context';
import {
  ArrowLeft,
  Camera,
  Layers,
  Box,
  CheckCircle2,
  ShieldCheck,
  Plus,
  Minus,
  MapPin,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui';
import { PackingViewer3D } from '@/components/packing/PackingViewer3D';

interface OperationPageProps {
  params: Promise<{ bookingId: string }>;
}

export default function CfsOperationPage({ params }: OperationPageProps) {
  const resolvedParams = use(params);
  const bookingId = resolvedParams.bookingId;
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'tally' | '3d' | 'sealing'>('tally');
  const [tallyCounts, setTallyCounts] = useState<Record<string, number>>({});
  const [discrepancyStates, setDiscrepancyStates] = useState<Record<string, boolean>>({});
  const [discrepancyReasons, setDiscrepancyReasons] = useState<Record<string, string>>({});
  const [containerNo, setContainerNo] = useState('');
  const [sealNo, setSealNo] = useState('');
  const [layerIndexInput, setLayerIndexInput] = useState<number>(1);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  // Fetch all CFS tasks to find this booking
  const { data: tasks, isLoading: isTasksLoading } = useQuery<any[]>({
    queryKey: ['cfs', 'tasks'],
    queryFn: () => fetchApi<any[]>('/cfs/tasks'),
    staleTime: 5000,
  });

  // Fetch proofs for this booking
  const { data: proofs, refetch: refetchProofs } = useQuery<any[]>({
    queryKey: ['loading-proofs', bookingId],
    queryFn: () => fetchApi<any[]>(`/loading-proofs/booking/${bookingId}`),
    staleTime: 5000,
  });

  const currentBooking = tasks?.find((t) => t.id === bookingId);
  const matchGroup = currentBooking?.matchGroup;

  // Initialize tally counts from existing data
  React.useEffect(() => {
    if (matchGroup?.matchGroupShipments) {
      const counts: Record<string, number> = {};
      const discStates: Record<string, boolean> = {};
      const reasons: Record<string, string> = {};

      matchGroup.matchGroupShipments.forEach((mgs: any) => {
        counts[mgs.shipmentId] =
          typeof mgs.actualPackageCount === 'number'
            ? mgs.actualPackageCount
            : mgs.shipment.totalPackages || 0;
        discStates[mgs.shipmentId] = !!mgs.isDiscrepant;
        reasons[mgs.shipmentId] = mgs.discrepancyReason || '';
      });

      setTallyCounts((prev) => ({ ...counts, ...prev }));
      setDiscrepancyStates((prev) => ({ ...discStates, ...prev }));
      setDiscrepancyReasons((prev) => ({ ...reasons, ...prev }));

      if (currentBooking?.containerNo) setContainerNo(currentBooking.containerNo);
      if (currentBooking?.sealNo) setSealNo(currentBooking.sealNo);
    }
  }, [matchGroup, currentBooking]);

  const canOperate = ['CFS_ADMIN', 'CFS_OPERATOR', 'PLATFORM_ADMIN', 'ADMIN'].includes(
    user?.role || '',
  );

  // Tally Mutation
  const tallyMutation = useMutation({
    mutationFn: async ({
      shipmentId,
      actualPackageCount,
      isDiscrepant,
      discrepancyReason,
    }: {
      shipmentId: string;
      actualPackageCount: number;
      isDiscrepant: boolean;
      discrepancyReason?: string;
    }) => {
      return fetchApi(`/cfs/tally/${matchGroup.id}/shipment/${shipmentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualPackageCount, isDiscrepant, discrepancyReason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cfs', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['cfs', 'metrics'] });
      setStatusMessage({ type: 'success', text: '✓ Đã cập nhật kiểm đếm lô hàng thành công!' });
      setTimeout(() => setStatusMessage(null), 4000);
    },
    onError: (err: any) => {
      setStatusMessage({ type: 'error', text: err.message || 'Lỗi khi cập nhật kiểm đếm' });
    },
  });

  // Photo Upload Handler (Camera capture)
  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    proofType: 'INBOUND_INSPECTION' | 'LAYER_PACKED' | 'SEAL_CLOSED',
    shipmentId?: string,
    layerIndex?: number,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFor(`${proofType}-${shipmentId || layerIndex || 'seal'}`);
    setStatusMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('bookingId', bookingId);
    formData.append('matchGroupId', matchGroup.id);
    formData.append('proofType', proofType);
    if (shipmentId) formData.append('shipmentId', shipmentId);
    if (layerIndex) formData.append('layerIndex', String(layerIndex));

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/loading-proofs/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      refetchProofs();
      setStatusMessage({ type: 'success', text: '✓ Đã tải ảnh nghiệm thu lên MinIO an toàn!' });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Lỗi khi tải ảnh lên MinIO' });
    } finally {
      setUploadingFor(null);
      e.target.value = '';
    }
  };

  // Sealing Mutation
  const sealMutation = useMutation({
    mutationFn: async () => {
      return fetchApi(`/cfs/seal-container/${bookingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerNo, sealNo }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cfs', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['cfs', 'metrics'] });
      setStatusMessage({ type: 'success', text: '✓ Đã niêm chì và chốt hoàn tất container thành công!' });
      setTimeout(() => setStatusMessage(null), 5000);
    },
    onError: (err: any) => {
      setStatusMessage({ type: 'error', text: err.message || 'Lỗi khi niêm chì container' });
    },
  });

  if (isTasksLoading || !currentBooking) {
    return (
      <div className="p-8 text-center max-w-4xl mx-auto font-sans">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-primary border-t-transparent mx-auto mb-3" />
        <p className="text-sm text-slate-500 font-medium">Đang nạp dữ liệu vận hành kho...</p>
      </div>
    );
  }

  const isSealed = currentBooking.status === 'SEALED';

  return (
    <div className="max-w-5xl mx-auto space-y-4 font-sans pb-24 px-2 sm:px-4">
      {/* Top Touch Navigation Bar */}
      <div className="flex items-center justify-between gap-2 py-2">
        <Link
          href="/dashboard/cfs"
          className="min-h-[48px] min-w-[48px] px-3.5 flex items-center justify-center gap-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm shadow-sm active:bg-slate-100"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="hidden sm:inline">Quay Lại Kho</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-slate-100 font-mono text-xs font-bold rounded-lg text-slate-700">
            {matchGroup.code}
          </span>
          <StatusBadge status={currentBooking.status} />
        </div>
      </div>

      {/* Touch Notification Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-xs underline font-bold ml-2">
            Đóng
          </button>
        </div>
      )}

      {/* Container Context Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wider font-bold text-slate-400">
              Container Gom Hàng LCL
            </div>
            <div className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>{matchGroup.lane?.name || matchGroup.laneId}</span>
              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded font-mono font-bold">
                {matchGroup.targetContainerType?.code || '40HC'}
              </span>
            </div>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            Booking: <strong className="text-slate-800">{currentBooking.bookingNumber}</strong>
          </div>
        </div>
      </div>

      {/* 3 Touch-First Segment Tabs (Large Tap Targets >= 48px) */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1 bg-slate-200/80 rounded-2xl">
        <button
          onClick={() => setActiveTab('tally')}
          className={`min-h-[50px] flex items-center justify-center gap-1.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            activeTab === 'tally'
              ? 'bg-white text-primary shadow-sm'
              : 'text-slate-600 hover:text-slate-900 active:bg-slate-300'
          }`}
        >
          <Box className="h-4 w-4" />
          <span>1. Kiểm Đếm</span>
        </button>

        <button
          onClick={() => setActiveTab('3d')}
          className={`min-h-[50px] flex items-center justify-center gap-1.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            activeTab === '3d'
              ? 'bg-white text-primary shadow-sm'
              : 'text-slate-600 hover:text-slate-900 active:bg-slate-300'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>2. Sơ Đồ 3D</span>
        </button>

        <button
          onClick={() => setActiveTab('sealing')}
          className={`min-h-[50px] flex items-center justify-center gap-1.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            activeTab === 'sealing'
              ? 'bg-white text-primary shadow-sm'
              : 'text-slate-600 hover:text-slate-900 active:bg-slate-300'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>3. Chụp & Niêm Chì</span>
        </button>
      </div>

      {/* TAB 1: TOUCH-FIRST TALLY & INBOUND INSPECTION */}
      {activeTab === 'tally' && (
        <div className="space-y-4">
          <div className="text-xs text-slate-500 font-medium px-1">
            Đối soát từng lô hàng khi tài xế hạ hàng tại cửa kho. Kiểm tra số kiện thực tế và chụp ảnh chứng nhận.
          </div>

          {matchGroup.matchGroupShipments.map((mgs: any) => {
            const shp = mgs.shipment;
            const currentCount = tallyCounts[shp.id] ?? shp.totalPackages;
            const isDisc = discrepancyStates[shp.id] ?? false;
            const discReason = discrepancyReasons[shp.id] ?? '';
            const inboundProofs = proofs?.filter(
              (p: any) => p.proofType === 'INBOUND_INSPECTION' && p.shipmentId === shp.id,
            ) || [];

            return (
              <div
                key={mgs.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4"
              >
                {/* Shipment Info */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {shp.trackingCode}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-slate-800 mt-1">
                      {shp.company?.name || 'Doanh nghiệp chủ hàng'}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Khai báo:</span>
                    <span className="text-sm font-extrabold text-slate-700 font-mono">
                      {shp.totalPackages} kiện
                    </span>
                  </div>
                </div>

                {/* Touch Stepper for Actual Package Count (Adjustment 1) */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <div className="text-xs font-bold text-slate-600 mb-2">
                    SỐ KIỆN THỰC NHẬN TẠI BÃI CFS:
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={!canOperate || isSealed}
                      onClick={() =>
                        setTallyCounts((prev) => ({
                          ...prev,
                          [shp.id]: Math.max(0, currentCount - 1),
                        }))
                      }
                      className="min-h-[52px] min-w-[52px] rounded-xl bg-white border border-slate-300 flex items-center justify-center text-slate-700 shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      <Minus className="h-6 w-6" />
                    </button>

                    <div className="flex-1 text-center">
                      <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-mono-numeric">
                        {currentCount}
                      </span>
                      <span className="text-xs text-slate-500 block font-medium">kiện thực tế</span>
                    </div>

                    <button
                      type="button"
                      disabled={!canOperate || isSealed}
                      onClick={() =>
                        setTallyCounts((prev) => ({
                          ...prev,
                          [shp.id]: currentCount + 1,
                        }))
                      }
                      className="min-h-[52px] min-w-[52px] rounded-xl bg-primary text-white flex items-center justify-center shadow-md active:scale-95 disabled:opacity-50"
                    >
                      <Plus className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                {/* Discrepancy Flag & Notes */}
                {canOperate && !isSealed && (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isDisc || currentCount !== shp.totalPackages}
                        onChange={(e) =>
                          setDiscrepancyStates((prev) => ({
                            ...prev,
                            [shp.id]: e.target.checked,
                          }))
                        }
                        className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs sm:text-sm font-semibold text-slate-700">
                        Ghi nhận sai lệch số lượng / móp méo rách bao bì
                      </span>
                    </label>

                    {(isDisc || currentCount !== shp.totalPackages) && (
                      <input
                        type="text"
                        placeholder="Nhập chi tiết sai lệch (VD: Thiếu 2 kiện, 1 thùng bị rách)..."
                        value={discReason}
                        onChange={(e) =>
                          setDiscrepancyReasons((prev) => ({
                            ...prev,
                            [shp.id]: e.target.value,
                          }))
                        }
                        className="w-full min-h-[48px] px-3.5 rounded-xl border border-amber-300 bg-amber-50/50 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                      />
                    )}
                  </div>
                )}

                {/* Photo Upload: Open Camera Directly with capture="environment" (Adjustment 1) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">
                      Ảnh Kiểm Kiện Nhập Kho ({inboundProofs.length} ảnh):
                    </span>
                    {canOperate && !isSealed && (
                      <label
                        htmlFor={`cam-inbound-${shp.id}`}
                        className="min-h-[48px] px-4 flex items-center gap-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold shadow-sm active:bg-blue-100 cursor-pointer"
                      >
                        <Camera className="h-4 w-4" />
                        <span>{uploadingFor === `INBOUND_INSPECTION-${shp.id}` ? 'Đang tải...' : 'Chụp Ảnh Kiện (Camera)'}</span>
                        <input
                          id={`cam-inbound-${shp.id}`}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          capture="environment"
                          className="hidden"
                          disabled={uploadingFor !== null}
                          onChange={(e) => handlePhotoUpload(e, 'INBOUND_INSPECTION', shp.id)}
                        />
                      </label>
                    )}
                  </div>

                  {/* Thumbnail gallery */}
                  {inboundProofs.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                      {inboundProofs.map((p: any) => (
                        <a
                          key={p.id}
                          href={p.presignedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
                        >
                          <img
                            src={p.presignedUrl}
                            alt="Ảnh kiện"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] p-1 truncate text-center">
                            {new Date(p.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Save Tally Action Button (Min 48px height) */}
                {canOperate && !isSealed && (
                  <button
                    type="button"
                    disabled={tallyMutation.isPending}
                    onClick={() =>
                      tallyMutation.mutate({
                        shipmentId: shp.id,
                        actualPackageCount: currentCount,
                        isDiscrepant: isDisc || currentCount !== shp.totalPackages,
                        discrepancyReason: discReason,
                      })
                    }
                    className="min-h-[48px] w-full flex items-center justify-center gap-2 rounded-xl font-bold text-xs sm:text-sm bg-slate-900 text-white hover:bg-black active:scale-[0.99] shadow-sm"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>LƯU KIỂM ĐẾM LÔ HÀNG NÀY</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: 3D CONTAINER VIEWER */}
      {activeTab === '3d' && (
        <div className="space-y-4">
          <div className="text-xs text-slate-500 font-medium px-1">
            Mô hình trực quan xếp container 3D. Hướng dẫn công nhân bốc xếp theo thứ tự LIFO và kiểm tra phân bố trọng lượng.
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-2 sm:p-4 shadow-sm overflow-hidden">
            <PackingViewer3D matchGroup={matchGroup} />
          </div>
        </div>
      )}

      {/* TAB 3: LAYER PHOTOS & SEALING */}
      {activeTab === 'sealing' && (
        <div className="space-y-5">
          {/* Section A: Layer-by-Layer Proofs */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-primary" />
                  Ảnh Nghiệm Thu Xếp Từng Lớp (Layer Packing)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Chụp ảnh chứng nhận từng lớp hàng được xếp vào container trước khi đóng kín.
                </p>
              </div>
            </div>

            {canOperate && !isSealed && (
              <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-xs font-bold text-slate-600">Lớp hàng:</div>
                <select
                  value={layerIndexInput}
                  onChange={(e) => setLayerIndexInput(Number(e.target.value))}
                  className="min-h-[44px] px-3 rounded-lg border border-slate-300 bg-white font-bold text-sm"
                >
                  <option value={1}>Lớp 1 (Đáy container)</option>
                  <option value={2}>Lớp 2 (Tầng giữa)</option>
                  <option value={3}>Lớp 3 (Tầng trên)</option>
                  <option value={4}>Lớp 4 (Cận nóc cont)</option>
                </select>

                <label
                  htmlFor="cam-layer"
                  className="flex-1 min-h-[48px] px-4 flex items-center justify-center gap-2 rounded-xl bg-primary text-white text-xs font-bold shadow-sm active:bg-primary-hover cursor-pointer"
                >
                  <Camera className="h-4 w-4" />
                  <span>{uploadingFor?.startsWith('LAYER_PACKED') ? 'Đang tải...' : `Chụp Ảnh Lớp ${layerIndexInput} (Camera)`}</span>
                  <input
                    id="cam-layer"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="hidden"
                    disabled={uploadingFor !== null}
                    onChange={(e) => handlePhotoUpload(e, 'LAYER_PACKED', undefined, layerIndexInput)}
                  />
                </label>
              </div>
            )}

            {/* Layer photos preview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {proofs
                ?.filter((p: any) => p.proofType === 'LAYER_PACKED')
                .map((p: any) => (
                  <a
                    key={p.id}
                    href={p.presignedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
                  >
                    <img
                      src={p.presignedUrl}
                      alt="Ảnh lớp"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[11px] font-bold p-1.5 truncate text-center">
                      Lớp {p.layerIndex || 1} • {new Date(p.createdAt).toLocaleTimeString('vi-VN')}
                    </div>
                  </a>
                ))}
            </div>
          </div>

          {/* Section B: Sealing and Completion */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Niêm Phong & Kẹp Chì Hải Quan (Seal Closed)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Nhập số hiệu container thật và số seal niêm phong trước khi xuất kho.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  MÃ SỐ CONTAINER THỰC TẾ:
                </label>
                <input
                  type="text"
                  placeholder="VD: TCLU-892145-2"
                  value={containerNo}
                  disabled={!canOperate || isSealed}
                  onChange={(e) => setContainerNo(e.target.value.toUpperCase())}
                  className="w-full min-h-[50px] px-3.5 rounded-xl border border-slate-300 font-mono text-sm font-bold uppercase focus:ring-2 focus:ring-primary outline-none disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  SỐ CHÌ NIÊM PHONG (SEAL NO):
                </label>
                <input
                  type="text"
                  placeholder="VD: VN-HP-00892"
                  value={sealNo}
                  disabled={!canOperate || isSealed}
                  onChange={(e) => setSealNo(e.target.value.toUpperCase())}
                  className="w-full min-h-[50px] px-3.5 rounded-xl border border-slate-300 font-mono text-sm font-bold uppercase focus:ring-2 focus:ring-primary outline-none disabled:bg-slate-100"
                />
              </div>
            </div>

            {/* Seal Photo Capture */}
            {canOperate && !isSealed && (
              <label
                htmlFor="cam-seal"
                className="min-h-[52px] w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs sm:text-sm font-bold shadow-sm active:bg-emerald-100 cursor-pointer"
              >
                <Camera className="h-5 w-5" />
                <span>{uploadingFor?.startsWith('SEAL_CLOSED') ? 'Đang tải...' : 'Chụp Ảnh Chì Niêm Phong (Camera)'}</span>
                <input
                  id="cam-seal"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  disabled={uploadingFor !== null}
                  onChange={(e) => handlePhotoUpload(e, 'SEAL_CLOSED')}
                />
              </label>
            )}

            {/* Seal photos preview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {proofs
                ?.filter((p: any) => p.proofType === 'SEAL_CLOSED')
                .map((p: any) => (
                  <a
                    key={p.id}
                    href={p.presignedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative aspect-video rounded-xl overflow-hidden border border-emerald-300 bg-emerald-50"
                  >
                    <img
                      src={p.presignedUrl}
                      alt="Ảnh niêm chì"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-emerald-950/80 text-white text-[11px] font-bold p-1.5 truncate text-center">
                      Seal Niêm Chì • {new Date(p.createdAt).toLocaleTimeString('vi-VN')}
                    </div>
                  </a>
                ))}
            </div>

            {/* Sealing Action Button (Min 56px height) */}
            {canOperate && !isSealed && (
              <button
                type="button"
                disabled={sealMutation.isPending}
                onClick={() => sealMutation.mutate()}
                className="min-h-[56px] w-full flex items-center justify-center gap-2 rounded-xl font-bold text-sm sm:text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg active:scale-[0.99] transition-all"
              >
                <ShieldCheck className="h-5 w-5" />
                <span>XÁC NHẬN ĐÓNG CONTAINER & NIÊM CHÌ</span>
              </button>
            )}

            {isSealed && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span>Container đã được niêm chì hoàn tất và sẵn sàng vận chuyển!</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
