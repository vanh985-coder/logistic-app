'use client';

import React, { useState, useMemo } from 'react';
import { StrategyEvaluation, CriterionResult } from './types';
import {
  PackageCheck,
  AlertTriangle,
  CheckCircle2,
  Info,
  Maximize2,
  Weight,
  Compass,
  Layers,
  ShieldCheck,
  ArrowDownToLine,
  Users,
  FileQuestion,
} from 'lucide-react';

interface StrategyEvaluationPanelProps {
  evaluation?: StrategyEvaluation;
  strategyName: string;
}

const CRITERION_ICONS: Record<string, React.ReactNode> = {
  volumeUtilization: <Maximize2 className="w-3.5 h-3.5 text-blue-400" />,
  weightUtilization: <Weight className="w-3.5 h-3.5 text-amber-400" />,
  cogDeviation: <Compass className="w-3.5 h-3.5 text-purple-400" />,
  stabilityScore: <Layers className="w-3.5 h-3.5 text-emerald-400" />,
  cargoCompatibility: <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />,
  lifoCompliance: <ArrowDownToLine className="w-3.5 h-3.5 text-teal-400" />,
  consigneeAccessibility: <Users className="w-3.5 h-3.5 text-indigo-400" />,
  // Short keys fallback
  fillRate: <Maximize2 className="w-3.5 h-3.5 text-blue-400" />,
  payload: <Weight className="w-3.5 h-3.5 text-amber-400" />,
  stability: <Layers className="w-3.5 h-3.5 text-emerald-400" />,
  compatibility: <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />,
  lifo: <ArrowDownToLine className="w-3.5 h-3.5 text-teal-400" />,
  accessibility: <Users className="w-3.5 h-3.5 text-indigo-400" />,
};

// Rating configurations supporting both English enums and Vietnamese aliases
const RATING_CONFIG: Record<
  string,
  { label: string; score: number; color: string; badgeBg: string; border: string; text: string }
> = {
  VERY_GOOD: {
    label: 'Rất tốt',
    score: 5,
    color: '#10B981', // emerald-500
    badgeBg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    text: 'text-emerald-300',
  },
  EXCELLENT: {
    label: 'Xuất sắc',
    score: 5,
    color: '#10B981',
    badgeBg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    text: 'text-emerald-300',
  },
  XUAT_SAC: {
    label: 'Xuất sắc',
    score: 5,
    color: '#10B981',
    badgeBg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    text: 'text-emerald-300',
  },
  RAT_TOT: {
    label: 'Rất tốt',
    score: 5,
    color: '#10B981',
    badgeBg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    text: 'text-emerald-300',
  },
  GOOD: {
    label: 'Tốt',
    score: 4,
    color: '#3B82F6', // blue-500
    badgeBg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
    text: 'text-blue-300',
  },
  TOT: {
    label: 'Tốt',
    score: 4,
    color: '#3B82F6',
    badgeBg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
    text: 'text-blue-300',
  },
  FAIR: {
    label: 'Khá',
    score: 3,
    color: '#06B6D4', // cyan-500
    badgeBg: 'bg-cyan-500/15',
    border: 'border-cyan-500/30',
    text: 'text-cyan-300',
  },
  KHA: {
    label: 'Khá',
    score: 3,
    color: '#06B6D4',
    badgeBg: 'bg-cyan-500/15',
    border: 'border-cyan-500/30',
    text: 'text-cyan-300',
  },
  AVERAGE: {
    label: 'Trung bình',
    score: 2,
    color: '#F59E0B', // amber-500
    badgeBg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    text: 'text-amber-300',
  },
  TRUNG_BINH: {
    label: 'Trung bình',
    score: 2,
    color: '#F59E0B',
    badgeBg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    text: 'text-amber-300',
  },
  POOR: {
    label: 'Cần cải thiện',
    score: 1,
    color: '#94A3B8', // slate-400
    badgeBg: 'bg-slate-500/15',
    border: 'border-slate-500/30',
    text: 'text-slate-300',
  },
};

export function StrategyEvaluationPanel({
  evaluation,
  strategyName,
}: StrategyEvaluationPanelProps) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Normalize criteria safely regardless of whether it arrives as an Object, an Array, or undefined
  const criteriaList: CriterionResult[] = useMemo(() => {
    if (!evaluation || !evaluation.criteria) return [];
    if (Array.isArray(evaluation.criteria)) return evaluation.criteria;
    if (typeof evaluation.criteria === 'object') {
      return Object.values(evaluation.criteria).filter(
        (item): item is CriterionResult => item !== null && typeof item === 'object' && ('name' in item || 'id' in item),
      );
    }
    return [];
  }, [evaluation]);

  // Robust guard: if evaluation is missing or criteria list is empty, show informative card instead of crashing
  if (!evaluation || criteriaList.length === 0) {
    return (
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5 text-center text-slate-400 space-y-2 shadow-lg">
        <FileQuestion className="w-8 h-8 text-slate-600 mx-auto" />
        <div className="text-xs font-semibold text-slate-300">
          Chưa có dữ liệu đánh giá 7 tiêu chí ({strategyName})
        </div>
        <p className="text-[11px] text-slate-500">
          Dữ liệu đánh giá chất lượng cho chiến lược này đang được xử lý hoặc chưa sẵn sàng.
        </p>
      </div>
    );
  }

  const totalCount = evaluation.totalCount ?? 0;
  const unplacedCount = evaluation.unplacedCount ?? 0;
  const placedCount = evaluation.placedCount ?? (totalCount - unplacedCount);
  const unplacedPercent = totalCount > 0 ? (unplacedCount / totalCount) * 100 : 0;
  const unplacedAlert =
    evaluation.unplacedAlert ||
    ((evaluation as any).unplacedLevel === 'CRITICAL' || unplacedPercent >= 10
      ? 'CRITICAL'
      : unplacedCount > 0
      ? 'WARNING'
      : 'NONE');

  return (
    <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-3 text-slate-200 shadow-lg">
      {/* 1. Hàng đầu tiên: Số kiện xếp được + Cảnh báo bỏ lại kiện */}
      <div
        className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
          unplacedCount === 0
            ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
            : unplacedAlert === 'CRITICAL'
            ? 'bg-rose-950/40 border-rose-500/40 text-rose-200 animate-pulse'
            : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {unplacedCount === 0 ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle
              className={`w-5 h-5 shrink-0 ${
                unplacedAlert === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400'
              }`}
            />
          )}
          <div>
            <div className="text-xs font-bold font-mono tracking-wide">
              Số kiện xếp được: {placedCount}/{totalCount} kiện
            </div>
            <div className="text-[11px] opacity-90">
              {unplacedCount === 0 ? (
                <span>Vừa vặn 100% trong 1 container — không có kiện tồn lại</span>
              ) : (
                <span>
                  Bỏ lại <strong>{unplacedCount} kiện</strong> ({unplacedPercent.toFixed(1)}%) — cần bố trí thêm container phụ
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span
            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase border ${
              unplacedCount === 0
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : unplacedAlert === 'CRITICAL'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}
          >
            {unplacedCount === 0 ? 'TỐI ƯU' : unplacedAlert === 'CRITICAL' ? 'NGUY HIỂM' : 'CẢNH BÁO'}
          </span>
        </div>
      </div>

      {/* 2. Bảng 7 tiêu chí đánh giá định tính */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
          <span>7 TIÊU CHÍ ĐÁNH GIÁ CHẤT LƯỢNG ({strategyName})</span>
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Info className="w-3 h-3" /> Rê chuột vào thanh để xem ý nghĩa
          </span>
        </div>

        <div className="space-y-1.5">
          {criteriaList.map((c) => {
            const criterionKey = c.id || (c as any).key || '';
            const config = RATING_CONFIG[c.rating] || RATING_CONFIG[c.ratingLabel] || RATING_CONFIG.TRUNG_BINH;
            const icon = CRITERION_ICONS[criterionKey] || <PackageCheck className="w-3.5 h-3.5 text-slate-400" />;
            const isPayload = criterionKey === 'weightUtilization' || criterionKey === 'payload';
            const showTooltip = activeTooltip === criterionKey;

            return (
              <div
                key={criterionKey || c.name}
                className="relative group p-2 rounded-lg bg-slate-950/50 hover:bg-slate-800/60 border border-slate-800/80 transition-colors cursor-help"
                onMouseEnter={() => setActiveTooltip(criterionKey)}
                onMouseLeave={() => setActiveTooltip(null)}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Cột trái: Icon + Tên tiêu chí */}
                  <div className="flex items-center gap-2 min-w-0 max-w-[180px] sm:max-w-[220px]">
                    <div className="p-1 rounded bg-slate-900 border border-slate-800 shrink-0">
                      {icon}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-medium text-slate-200 truncate" title={c.name}>
                        {c.name}
                      </div>
                      {isPayload && (
                        <div className="text-[9px] text-slate-500 italic">
                          (Đặc thù hàng cồng kềnh nhẹ)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cột giữa: Thanh định tính 5 nấc (KHÔNG HIỆN %) */}
                  <div className="flex-1 max-w-[130px] sm:max-w-[160px]">
                    <div className="grid grid-cols-5 gap-1 h-2 bg-slate-900/90 rounded-sm p-0.5 border border-slate-800">
                      {[1, 2, 3, 4, 5].map((lvl) => {
                        const filled = lvl <= config.score;
                        return (
                          <div
                            key={lvl}
                            className={`h-full rounded-[1px] transition-all duration-300 ${
                              filled ? '' : 'bg-slate-800/60'
                            }`}
                            style={{
                              backgroundColor: filled ? config.color : undefined,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Cột phải: Nhãn định tính */}
                  <div className="w-20 text-right shrink-0">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${config.badgeBg} ${config.border} ${config.text}`}
                    >
                      {c.ratingLabel || config.label}
                    </span>
                  </div>
                </div>

                {/* Hover Tooltip giải thích tiêu chí */}
                {showTooltip && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 sm:w-80 p-2.5 rounded-lg bg-slate-950 text-slate-200 text-xs shadow-2xl border border-slate-700 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                    <div className="font-semibold text-white flex items-center justify-between pb-1 border-b border-slate-800 mb-1">
                      <span className="flex items-center gap-1.5">
                        {icon} {c.name}
                      </span>
                      <span className={`text-[10px] font-bold ${config.text}`}>
                        Đạt: {c.ratingLabel || config.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {c.description}
                    </p>
                    {isPayload && (
                      <div className="mt-1.5 p-1.5 rounded bg-amber-950/40 border border-amber-800/50 text-[10px] text-amber-200">
                        <strong>Chú thích nghiệp vụ:</strong> Đối với hàng may mặc, điện tử, nội thất cồng kềnh nhẹ, thể tích cont đầy 73% trước khi tải trọng đạt mức tối đa. Mức đánh giá "Trung bình" cho tải trọng là chuẩn mực hợp lý của lô hàng dạng này.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
