import React from 'react';
import { CenterOfGravity } from './types';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

interface PackingCoGIndicatorProps {
  cog: CenterOfGravity;
  cogViolation: boolean;
  cogWarning?: string;
  containerLengthMm: number;
  containerWidthMm: number;
}

export function PackingCoGIndicator({
  cog,
  cogViolation,
  cogWarning,
}: PackingCoGIndicatorProps) {
  const isSafe = !cogViolation && cog.xPercentage >= 45 && cog.xPercentage <= 55;

  return (
    <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 text-slate-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isSafe ? (
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          )}
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Phân Bổ Trọng Tâm (Center of Gravity - CoG)
          </span>
        </div>
        <span
          className={`text-[11px] font-mono-numeric px-2 py-0.5 rounded-full font-bold border ${
            isSafe
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
          }`}
        >
          {isSafe ? 'ĐẠT CHUẨN AN TOÀN' : 'CẢNH BÁO LỆCH TẢI'}
        </span>
      </div>

      {/* 2D Top-View Schematic Projection Diagram */}
      <div className="relative w-full h-24 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden my-2.5">
        {/* Bulkhead (Đầu container - Front) & Door (Cửa container - Rear) labels */}
        <div className="absolute left-2 top-1 text-[9px] font-mono text-slate-500 uppercase">
          0% (Đầu Cont)
        </div>
        <div className="absolute right-2 top-1 text-[9px] font-mono text-slate-500 uppercase">
          100% (Cửa Cont)
        </div>

        {/* Center line (50%) */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px border-l border-dashed border-slate-700 pointer-events-none" />

        {/* 45% - 55% Safe Tolerance Zone */}
        <div
          className="absolute top-0 bottom-0 bg-emerald-500/15 border-x border-emerald-500/40 flex items-center justify-center pointer-events-none"
          style={{ left: '45%', width: '10%' }}
        >
          <span className="text-[9px] font-mono font-bold text-emerald-400/80 -rotate-90 select-none">
            45-55%
          </span>
        </div>

        {/* CoG Indicator Point (Top-view X & Y coordinates) */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500 pointer-events-none"
          style={{
            left: `${Math.max(2, Math.min(98, cog.xPercentage))}%`,
            top: `${Math.max(15, Math.min(85, cog.yPercentage))}%`,
          }}
        >
          <div className="relative">
            <span
              className={`block w-3.5 h-3.5 rounded-full ${
                isSafe
                  ? 'bg-emerald-400 shadow-[0_0_12px_#34D399] ring-2 ring-emerald-300'
                  : 'bg-rose-500 shadow-[0_0_14px_#F43F5E] ring-2 ring-rose-300 animate-ping'
              }`}
            />
            <span
              className={`absolute inset-0 block w-3.5 h-3.5 rounded-full ${
                isSafe ? 'bg-emerald-400' : 'bg-rose-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Numerical CoG Details */}
      <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono-numeric">
        <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
          <div className="text-[10px] text-slate-400 uppercase">Trục X (Dọc)</div>
          <div
            className={`text-xs font-bold ${
              isSafe ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {cog.xPercentage.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500">{cog.xMm.toLocaleString()} mm</div>
        </div>

        <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
          <div className="text-[10px] text-slate-400 uppercase">Trục Y (Ngang)</div>
          <div className="text-xs font-bold text-slate-200">
            {cog.yPercentage.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500">{cog.yMm.toLocaleString()} mm</div>
        </div>

        <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
          <div className="text-[10px] text-slate-400 uppercase">Trục Z (Cao)</div>
          <div className="text-xs font-bold text-slate-200">
            {cog.zPercentage.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500">{cog.zMm.toLocaleString()} mm</div>
        </div>
      </div>

      {/* Violation Alert / Notes */}
      {cogViolation && (
        <div className="mt-2.5 p-2 rounded bg-rose-950/40 border border-rose-800/60 text-[11px] text-rose-300 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400 mt-0.5" />
          <span>
            {cogWarning || 'Trọng tâm nằm ngoài dải an toàn 45%–55%. Cần xem xét dỡ bớt hoặc dịch chuyển kiện nặng.'}
          </span>
        </div>
      )}
    </div>
  );
}
