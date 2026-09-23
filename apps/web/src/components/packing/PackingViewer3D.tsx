'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { fetchApi } from '@/lib/api-client';
import { MatchGroupDto } from '@logix/shared';
import {
  ContainerDimension,
  PackingResult,
  PackageMetadata,
  PackedPlacement,
  PackingStrategy,
  MultiStrategyPackingResult,
} from './types';
import { PackingCoGIndicator } from './PackingCoGIndicator';
import { PackageDetailCard } from './PackageDetailCard';
import { UnplacedPackagesCard } from './UnplacedPackagesCard';
import { StrategyEvaluationPanel } from './StrategyEvaluationPanel';
import { exportStowagePlanToExcel, computeUnloadingSequence } from './excelExporter';
import {
  Box,
  Sparkles,
  Zap,
  AlertCircle,
  Database,
  RefreshCw,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  PlayCircle,
  FileSpreadsheet,
  Maximize2,
  Users,
  ArrowDownToLine,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui';

// Calibrated 12 Shipper Color Palette from docs/design-spec.md
export const SHIPPER_COLORS = [
  { id: 1, color: '#D946EF', name: 'Magenta' },
  { id: 2, color: '#EAB308', name: 'Mustard' },
  { id: 3, color: '#38BDF8', name: 'Cyan' },
  { id: 4, color: '#84CC16', name: 'Lime' },
  { id: 5, color: '#F472B6', name: 'Pink' },
  { id: 6, color: '#7C3AED', name: 'Violet' },
  { id: 7, color: '#D4B996', name: 'Tan' },
  { id: 8, color: '#94A3B8', name: 'Slate' },
  { id: 9, color: '#BE185D', name: 'Berry' },
  { id: 10, color: '#4D7C0F', name: 'Olive' },
  { id: 11, color: '#B45309', name: 'Amber' },
  { id: 12, color: '#64748B', name: 'Steel' },
];

const STRATEGIES: Array<{
  id: PackingStrategy;
  name: string;
  sub: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'MAX_VOLUME',
    name: 'Tối ưu thể tích',
    sub: 'Ưu tiên: Tận dụng tối đa không gian container',
    icon: <Maximize2 className="h-4 w-4" />,
  },
  {
    id: 'CONSIGNEE_GROUPED',
    name: 'Gom theo chủ hàng',
    sub: 'Ưu tiên: Kiện cùng chủ hàng nằm liền khối, dỡ và kiểm đếm tập trung',
    icon: <Users className="h-4 w-4" />,
  },
  {
    id: 'LIFO_PRIORITY',
    name: 'Ưu tiên thứ tự dỡ',
    sub: 'Ưu tiên: Dỡ hàng theo hành trình từ điểm gần đến điểm xa, không đảo hàng',
    icon: <ArrowDownToLine className="h-4 w-4" />,
  },
];

// Dynamically import Three.js Scene to prevent SSR canvas errors in Next.js
const PackingScene = dynamic(
  () => import('./PackingScene').then((mod) => mod.PackingScene),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[460px] bg-[#090D16] flex flex-col items-center justify-center text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
        <span className="text-xs font-mono">Đang khởi tạo WebGL 3D Canvas...</span>
      </div>
    ),
  },
);

interface PackingViewer3DProps {
  matchGroup: MatchGroupDto;
}

export function PackingViewer3D({ matchGroup }: PackingViewer3DProps) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCached, setIsCached] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Packing strategy data states
  const [multiStrategyResult, setMultiStrategyResult] = useState<MultiStrategyPackingResult | null>(null);
  const [legacyResult, setLegacyResult] = useState<PackingResult | null>(null);
  const [activeStrategy, setActiveStrategy] = useState<PackingStrategy>('MAX_VOLUME');

  // Interactive selection and playback states
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Unloading animation player states
  const [isUnloading, setIsUnloading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [hideUnloaded, setHideUnloaded] = useState<boolean>(true);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const targetContainer = matchGroup.targetContainerType;
  const containerDim: ContainerDimension = useMemo(() => {
    return {
      innerLengthMm: targetContainer?.innerLengthMm ?? 12032,
      innerWidthMm: targetContainer?.innerWidthMm ?? 2352,
      innerHeightMm: targetContainer?.innerHeightMm ?? 2698,
      maxPayloadGram: targetContainer ? Number(targetContainer.maxPayloadGram) : 26500000,
    };
  }, [targetContainer]);

  // Build O(1) Package Metadata Lookup & assign Shipper Colors
  const { packagesMap, shipperLegends } = useMemo(() => {
    const map = new Map<string, PackageMetadata>();
    const companyColorMap = new Map<string, typeof SHIPPER_COLORS[0]>();
    const legends: Array<{ companyId: string; name: string; color: string; count: number }> = [];

    let colorIndex = 0;
    let dropIdx = 1;

    if (matchGroup.shipments) {
      for (const mgs of matchGroup.shipments) {
        const s = mgs.shipment;
        if (!s) continue;

        const companyId = s.companyId;
        if (!companyColorMap.has(companyId)) {
          const colorObj = SHIPPER_COLORS[colorIndex % SHIPPER_COLORS.length];
          companyColorMap.set(companyId, colorObj);
          legends.push({
            companyId,
            name: s.company?.name || `Chủ hàng ${colorIndex + 1}`,
            color: colorObj.color,
            count: 0,
          });
          colorIndex++;
        }

        const colorObj = companyColorMap.get(companyId)!;
        const legendEntry = legends.find((l) => l.companyId === companyId);

        if (s.packages) {
          for (const pkg of s.packages) {
            if (legendEntry) legendEntry.count++;

            map.set(pkg.id, {
              packageId: pkg.id,
              packageCode: pkg.packageCode,
              shipmentTrackingCode: s.trackingCode,
              companyName: s.company?.name || 'Doanh nghiệp Shipper',
              taxCode: s.company?.taxCode,
              lengthMm: pkg.lengthMm,
              widthMm: pkg.widthMm,
              heightMm: pkg.heightMm,
              weightGrams: pkg.weightGrams,
              isFragile: pkg.isFragile,
              noStack: pkg.noStack,
              dropOrder: mgs.dropOrder ?? dropIdx,
              deliveryDestination: mgs.deliveryDestination || 'Kho CFS đích',
              color: colorObj.color,
              colorName: colorObj.name,
            });
          }
        }
        dropIdx++;
      }
    }

    return { packagesMap: map, shipperLegends: legends };
  }, [matchGroup]);

  // Active Strategy Result (Cached in React state — 0ms tab switching)
  const activePackingResult: PackingResult | null = useMemo(() => {
    if (multiStrategyResult?.strategies) {
      return multiStrategyResult.strategies[activeStrategy] || null;
    }
    return legacyResult;
  }, [multiStrategyResult, legacyResult, activeStrategy]);

  // Precomputed physical unloading sequence for active strategy
  const unloadingSequence = useMemo(() => {
    if (!activePackingResult || activePackingResult.placedPackages.length === 0) return [];
    return computeUnloadingSequence(activePackingResult.placedPackages, packagesMap);
  }, [activePackingResult, packagesMap]);

  // Sync selected package during unloading simulation
  useEffect(() => {
    if (isUnloading && unloadingSequence.length > 0) {
      const placementIdx = unloadingSequence[currentStep - 1];
      if (placementIdx !== undefined) {
        setSelectedIndex(placementIdx);
      }
    }
  }, [isUnloading, currentStep, unloadingSequence]);

  // Playback timer for unloading animation
  useEffect(() => {
    if (!isUnloading || !isPlaying || unloadingSequence.length === 0) return;

    const intervalMs = Math.round(900 / playbackSpeed);
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= unloadingSequence.length) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isUnloading, isPlaying, playbackSpeed, unloadingSequence.length]);

  // Start Calculation & Polling Flow
  const startPackingCalculation = async () => {
    setIsLoading(true);
    setError(null);
    setElapsedSeconds(0);

    // Stop existing timers
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    try {
      // 1. Send POST /packing/calculate
      const res = await fetchApi<{
        statusCode: number;
        status: string;
        cached?: boolean;
        jobId?: string;
        result?: MultiStrategyPackingResult | PackingResult;
      }>('/packing/calculate', {
        method: 'POST',
        body: JSON.stringify({ matchGroupId: matchGroup.id }),
      });

      // Cache HIT: Result is immediate
      if (res.result && (res.cached || res.status === 'completed')) {
        const rawResult = res.result;
        if ('strategies' in rawResult && rawResult.strategies) {
          setMultiStrategyResult(rawResult as MultiStrategyPackingResult);
        } else {
          setLegacyResult(rawResult as PackingResult);
        }
        setIsCached(Boolean(res.cached));
        setIsLoading(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        return;
      }

      // Cache MISS: Job enqueued, start Polling
      if (res.jobId) {
        const jobId = res.jobId;
        let pollDelay = 1000;
        let pollCount = 0;

        const poll = async () => {
          pollCount++;
          try {
            const jobRes = await fetchApi<{
              jobId: string;
              status: 'waiting' | 'active' | 'completed' | 'failed';
              result?: MultiStrategyPackingResult | PackingResult;
              error?: string;
            }>(`/packing/jobs/${jobId}`);

            if (jobRes.status === 'completed' && jobRes.result) {
              const rawResult = jobRes.result;
              if ('strategies' in rawResult && rawResult.strategies) {
                setMultiStrategyResult(rawResult as MultiStrategyPackingResult);
              } else {
                setLegacyResult(rawResult as PackingResult);
              }
              setIsCached(false);
              setIsLoading(false);
              if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
              if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
              return;
            }

            if (jobRes.status === 'failed') {
              setError(jobRes.error || 'Thuật toán tính toán vị trí 3D gặp lỗi.');
              setIsLoading(false);
              if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
              if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
              return;
            }

            // Backoff to 2s after 10 seconds
            if (pollCount >= 10 && pollDelay === 1000) {
              pollDelay = 2000;
              if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = setInterval(poll, pollDelay);
            }
          } catch (err: any) {
            setError(err.message || 'Lỗi kết nối khi polling trạng thái packing.');
            setIsLoading(false);
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          }
        };

        pollingIntervalRef.current = setInterval(poll, pollDelay);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể khởi tạo yêu cầu tính toán 3D packing.');
      setIsLoading(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  useEffect(() => {
    startPackingCalculation();

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [matchGroup.id]);

  // Strategy tab switch handler (reads from memory, 0ms latency)
  const handleSelectStrategy = (strat: PackingStrategy) => {
    setActiveStrategy(strat);
    setSelectedIndex(null);
    setCurrentStep(1);
    setIsPlaying(false);
  };

  // Toggle unloading playback
  const handleToggleUnloading = () => {
    if (isUnloading) {
      setIsUnloading(false);
      setIsPlaying(false);
    } else {
      setIsUnloading(true);
      setCurrentStep(1);
      setIsPlaying(true);
    }
  };

  // Excel export trigger (2 sheets)
  const handleExportExcel = () => {
    if (!activePackingResult) return;
    exportStowagePlanToExcel({
      matchGroup,
      strategy: activeStrategy,
      packingResult: activePackingResult,
      packagesMap,
      containerDim,
    });
  };

  // Selected package details
  const selectedPlacement: PackedPlacement | null = useMemo(() => {
    if (selectedIndex === null || !activePackingResult || !activePackingResult.placedPackages[selectedIndex]) {
      return null;
    }
    return activePackingResult.placedPackages[selectedIndex];
  }, [selectedIndex, activePackingResult]);

  const selectedMetadata: PackageMetadata | null = useMemo(() => {
    if (!selectedPlacement) return null;
    return packagesMap.get(selectedPlacement.packageId) || null;
  }, [selectedPlacement, packagesMap]);

  return (
    <div className="space-y-4">
      {/* 3D Viewport Header Bar (Dark Mode Container) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#090D16] border border-slate-800 text-slate-100 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Mô Phỏng Không Gian Xếp Container 3D (3D Packing Engine)
                </h3>
                {isCached ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <Database className="h-3 w-3" />
                    Kết quả đã lưu (Redis Cache)
                  </span>
                ) : activePackingResult ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    <Zap className="h-3 w-3" />
                    Vừa tính toán ({activePackingResult.executionTimeMs} ms)
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Vỏ cont {targetContainer?.code} ({targetContainer?.innerLengthMm}×{targetContainer?.innerWidthMm}×{targetContainer?.innerHeightMm} mm) • Extreme Point Heuristic Đa Tiêu Chí
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              variant={isUnloading ? 'primary' : 'outline'}
              size="sm"
              onClick={handleToggleUnloading}
              disabled={isLoading || !activePackingResult}
              className={`text-xs ${
                isUnloading
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold border-amber-400 shadow-lg'
                  : 'text-amber-300 border-amber-500/40 hover:bg-amber-950/40'
              }`}
              leftIcon={<PlayCircle className="h-3.5 w-3.5" />}
            >
              {isUnloading ? 'Dừng xem thứ tự dỡ' : 'Xem thứ tự dỡ'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={isLoading || !activePackingResult}
              className="text-xs text-emerald-300 border-emerald-500/40 hover:bg-emerald-950/40"
              leftIcon={<FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />}
            >
              Xuất Excel
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={startPackingCalculation}
              isLoading={isLoading}
              className="text-xs text-slate-300 border-slate-700 hover:bg-slate-800"
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Tính toán lại
            </Button>
          </div>
        </div>

        {/* Dynamic Shipper Legend Bar with 12 Calibrated Colors */}
        <div className="flex items-center gap-2 flex-wrap text-xs pt-0.5">
          <span className="text-[11px] text-slate-400 font-medium">Bảng màu chủ hàng ({shipperLegends.length}):</span>
          {shipperLegends.map((sh) => (
            <div
              key={sh.companyId}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-200"
            >
              <span
                className="w-3 h-3 rounded shadow-sm border border-white/20 shrink-0"
                style={{ backgroundColor: sh.color }}
              />
              <span className="font-medium truncate max-w-[130px]">{sh.name}</span>
              <span className="text-[10px] text-slate-500 font-mono-numeric">({sh.count}k)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        /* Progress Skeleton Loading */
        <div className="rounded-2xl bg-[#090D16] border border-slate-800 p-8 text-center text-slate-100 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
            <Box className="h-8 w-8 animate-bounce" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h4 className="text-sm font-bold text-white">
              Đang Tối Ưu Hóa Cả 3 Chiến Lược Xếp Container 3D...
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Động cơ 3D Extreme Point đang tính toán đồng thời 3 phương án: Tối ưu thể tích, Gom theo chủ hàng, và Ưu tiên thứ tự dỡ.
            </p>
          </div>

          {/* Animated Progress Bar */}
          <div className="max-w-xs mx-auto space-y-2">
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full animate-pulse w-3/4" />
            </div>
            <div className="text-[11px] font-mono text-slate-400 flex justify-between">
              <span>Đang tính toán 3 chiến lược song song</span>
              <span>{elapsedSeconds}s</span>
            </div>
          </div>
        </div>
      ) : error ? (
        /* Error State */
        <div className="rounded-2xl bg-[#090D16] border border-rose-900/50 p-8 text-center text-slate-100 space-y-4">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-rose-400">Không Thể Hoàn Tất Mô Phỏng 3D</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
          </div>
          <Button variant="primary" size="sm" onClick={startPackingCalculation}>
            Thử lại ngay
          </Button>
        </div>
      ) : activePackingResult ? (
        <div className="space-y-4">
          {/* 1. THREE STRATEGY TABS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {STRATEGIES.map((strat) => {
              const isSelected = activeStrategy === strat.id;
              return (
                <button
                  key={strat.id}
                  onClick={() => handleSelectStrategy(strat.id)}
                  className={`p-3 rounded-xl text-left border transition-all duration-200 relative ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg ring-1 ring-blue-500/50'
                      : 'bg-slate-900/70 border-slate-800/90 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-1.5 rounded-lg shrink-0 ${
                          isSelected ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {strat.icon}
                      </div>
                      <span className="text-xs font-bold truncate tracking-tight">{strat.name}</span>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Đang chọn
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-[11px] leading-snug pl-0.5 ${
                      isSelected ? 'text-blue-200/90' : 'text-slate-500'
                    }`}
                  >
                    {strat.sub}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 2. UNLOADING ANIMATION PLAYER BAR (Conditional when active) */}
          {isUnloading && (
            <div className="p-3 sm:p-4 rounded-xl bg-slate-900 border-2 border-amber-500/60 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <div>
                  <div className="text-xs font-bold font-mono text-amber-300">
                    MÔ PHỎNG DỠ HÀNG (UNLOADING SEQUENCE)
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Đang bốc: Kiện <strong className="text-white">{currentStep}</strong> / {unloadingSequence.length}
                  </div>
                </div>
              </div>

              {/* Player Controls: Prev, Play/Pause, Next, Scrub Slider */}
              <div className="flex items-center gap-2.5 w-full md:w-auto flex-1 md:max-w-xl px-2">
                <button
                  onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                  disabled={currentStep <= 1}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition shrink-0"
                  title="Kiện trước"
                >
                  <SkipBack className="h-4 w-4" />
                </button>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg transition shrink-0"
                  title={isPlaying ? 'Tạm dừng (Pause)' : 'Phát tiếp (Play)'}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                </button>

                <button
                  onClick={() => setCurrentStep((prev) => Math.min(unloadingSequence.length, prev + 1))}
                  disabled={currentStep >= unloadingSequence.length}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition shrink-0"
                  title="Kiện tiếp theo"
                >
                  <SkipForward className="h-4 w-4" />
                </button>

                {/* Progress Scrub Slider */}
                <input
                  type="range"
                  min={1}
                  max={Math.max(1, unloadingSequence.length)}
                  value={currentStep}
                  onChange={(e) => setCurrentStep(Number(e.target.value))}
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />

                {/* Speed Controls */}
                <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-[11px] font-mono shrink-0">
                  {[0.5, 1, 2].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`px-1.5 py-0.5 rounded transition ${
                        playbackSpeed === spd
                          ? 'bg-amber-500 text-slate-950 font-bold shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Options & Close Button */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setHideUnloaded(!hideUnloaded)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition ${
                    hideUnloaded
                      ? 'bg-slate-800 border-slate-700 text-slate-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                  title="Ẩn hoàn toàn các kiện đã dỡ để nhìn xuyên vào sâu container"
                >
                  {hideUnloaded ? <EyeOff className="h-3.5 w-3.5 text-amber-400" /> : <Eye className="h-3.5 w-3.5" />}
                  <span>{hideUnloaded ? 'Đang ẩn kiện đã dỡ' : 'Hiện kiện đã dỡ'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsUnloading(false);
                    setIsPlaying(false);
                  }}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                  title="Đóng chế độ dỡ"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* 3. TOP KPI METRICS ROW */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono-numeric">
            <div className="p-3.5 rounded-xl bg-[#090D16] border border-slate-800 text-slate-200">
              <div className="text-[10px] uppercase text-slate-400 font-sans">Lấp Đầy Thể Tích</div>
              <div className="text-lg font-bold text-emerald-400 mt-0.5">
                {(activePackingResult.fillRateBps / 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-500">
                {(Number(activePackingResult.totalVolumeMm3) / 1e9).toFixed(3)} m³ hiệu dụng
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#090D16] border border-slate-800 text-slate-200">
              <div className="text-[10px] uppercase text-slate-400 font-sans">Kiện Hàng Đã Xếp</div>
              <div className="text-lg font-bold text-blue-400 mt-0.5">
                {activePackingResult.placedPackages.length}
                <span className="text-xs text-slate-400 font-normal">
                  {' '}/ {activePackingResult.placedPackages.length + activePackingResult.unplacedPackages.length} kiện
                </span>
              </div>
              <div className="text-[10px] text-slate-500">
                {activePackingResult.unplacedPackages.length === 0 ? 'Toàn bộ 100% kiện xếp được' : `Chưa xếp ${activePackingResult.unplacedPackages.length} kiện`}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#090D16] border border-slate-800 text-slate-200">
              <div className="text-[10px] uppercase text-slate-400 font-sans">Tổng Khối Lượng</div>
              <div className="text-lg font-bold text-indigo-400 mt-0.5">
                {(activePackingResult.totalWeightGrams / 1000).toLocaleString('vi-VN')} kg
              </div>
              <div className="text-[10px] text-slate-500">
                Tải trọng cont: {(containerDim.maxPayloadGram / 1000).toLocaleString()} kg
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#090D16] border border-slate-800 text-slate-200">
              <div className="text-[10px] uppercase text-slate-400 font-sans">Thời Gian Tính</div>
              <div className="text-lg font-bold text-slate-100 mt-0.5">
                {activePackingResult.executionTimeMs} ms
              </div>
              <div className="text-[10px] text-slate-500">
                {activePackingResult.iterationsExecuted} vòng lặp Extreme Points
              </div>
            </div>
          </div>

          {/* 4. MAIN 3D VIEWPORT & SIDEBAR PANELS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* 3D Viewport Column (8 cols on lg) */}
            <div className="lg:col-span-8 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-[#090D16]">
              <PackingScene
                container={containerDim}
                placements={activePackingResult.placedPackages}
                packagesMap={packagesMap}
                selectedIndex={selectedIndex}
                onSelectIndex={setSelectedIndex}
                isUnloadingMode={isUnloading}
                unloadingStep={currentStep}
                unloadingSequence={unloadingSequence}
                hideUnloaded={hideUnloaded}
                onStepChange={(step) => {
                  setCurrentStep(step);
                  setIsPlaying(false);
                }}
              />
            </div>

            {/* Right Information Panels Column (4 cols on lg) */}
            <div className="lg:col-span-4 space-y-4">
              {/* Strategy Evaluation Qualitative Scorecard (7 Criteria + Top Placed/Unplaced Banner) */}
              <StrategyEvaluationPanel
                evaluation={activePackingResult.evaluation}
                strategyName={STRATEGIES.find((s) => s.id === activeStrategy)?.name || activeStrategy}
              />

              {/* Selected Package Details Panel (Includes Shipper, Delivery Destination, SKU, Dimensions) */}
              <PackageDetailCard
                placement={selectedPlacement}
                metadata={selectedMetadata}
                onClose={() => setSelectedIndex(null)}
              />

              {/* Center of Gravity CoG 2D Diagram Panel */}
              <PackingCoGIndicator
                cog={activePackingResult.centerOfGravity}
                cogViolation={activePackingResult.cogViolation}
                cogWarning={activePackingResult.cogWarning}
                containerLengthMm={containerDim.innerLengthMm}
                containerWidthMm={containerDim.innerWidthMm}
              />

              {/* Unplaced Packages Card */}
              <UnplacedPackagesCard
                unplaced={activePackingResult.unplacedPackages}
                packagesMap={packagesMap}
                totalPlaced={activePackingResult.placedPackages.length}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
