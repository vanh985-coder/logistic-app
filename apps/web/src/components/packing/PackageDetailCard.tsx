import React from 'react';
import { PackageMetadata, PackedPlacement } from './types';
import { Box, X, ShieldAlert, Ban, ArrowDownToLine, MapPin } from 'lucide-react';
import { Button } from '@/components/ui';

interface PackageDetailCardProps {
  placement: PackedPlacement | null;
  metadata: PackageMetadata | null;
  onClose: () => void;
}

export function PackageDetailCard({
  placement,
  metadata,
  onClose,
}: PackageDetailCardProps) {
  if (!placement || !metadata) {
    return (
      <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-5 text-center text-slate-400">
        <Box className="h-7 w-7 text-slate-600 mx-auto mb-2" />
        <div className="text-xs font-semibold text-slate-300">Chưa chọn kiện hàng</div>
        <p className="text-[11px] text-slate-500 mt-1">
          Nhấp chuột trực tiếp vào một khối kiện trong khung nhìn 3D để xem chi tiết thông số tọa độ và chủ sở hữu.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-700/80 p-4 text-slate-100 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded-md border border-white/30 shrink-0 shadow"
            style={{ backgroundColor: metadata.color }}
            title={metadata.colorName}
          />
          <div>
            <div className="text-xs font-mono font-bold text-white tracking-wider">
              {metadata.packageCode}
            </div>
            <div className="text-[11px] text-slate-400">
              Vận đơn: <span className="font-mono text-slate-300">{metadata.shipmentTrackingCode}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Bỏ chọn"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Shipper info */}
      <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
        <div className="text-[10px] text-slate-400 uppercase font-medium">Chủ Hàng (Shipper)</div>
        <div className="text-xs font-semibold text-white mt-0.5">{metadata.companyName}</div>
        {metadata.taxCode && (
          <div className="text-[10px] text-slate-500 font-mono">MST: {metadata.taxCode}</div>
        )}
      </div>

      {/* Delivery Destination (Crucial for LIFO understanding) */}
      <div className="p-2.5 rounded-lg bg-blue-950/30 border border-blue-800/50">
        <div className="text-[10px] text-blue-300 uppercase font-medium flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-blue-400" />
          <span>Điểm Giao Hàng (Hành trình dỡ)</span>
        </div>
        <div className="text-xs font-semibold text-white mt-0.5">
          {metadata.deliveryDestination || 'Kho trung tâm đích'}
        </div>
        {metadata.dropOrder && (
          <div className="text-[10px] text-blue-400 font-mono mt-0.5">
            Thứ tự điểm trả: Trạm #{metadata.dropOrder}
          </div>
        )}
      </div>

      {/* Dimensions & Weight Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono-numeric">
        <div className="p-2 rounded bg-slate-950/50 border border-slate-800/80">
          <div className="text-[10px] text-slate-400 uppercase">Kích thước (D × R × C)</div>
          <div className="font-bold text-slate-200 mt-0.5">
            {placement.placedLengthMm} × {placement.placedWidthMm} × {placement.placedHeightMm}
          </div>
          <div className="text-[10px] text-slate-500">mm</div>
        </div>

        <div className="p-2 rounded bg-slate-950/50 border border-slate-800/80">
          <div className="text-[10px] text-slate-400 uppercase">Khối Lượng</div>
          <div className="font-bold text-slate-200 mt-0.5">
            {(metadata.weightGrams / 1000).toLocaleString('vi-VN')} kg
          </div>
          <div className="text-[10px] text-slate-500">{metadata.weightGrams.toLocaleString()} g</div>
        </div>
      </div>

      {/* 3D Coordinates (x, y, z) */}
      <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-medium">
          <MapPin className="h-3 w-3 text-blue-400" />
          Tọa độ không gian (Extreme Point Coord)
        </div>
        <div className="grid grid-cols-3 gap-2 text-center font-mono-numeric text-xs pt-1">
          <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400">X (Dài): </span>
            <span className="font-bold text-blue-400">{placement.xMm}</span>
          </div>
          <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400">Y (Rộng): </span>
            <span className="font-bold text-blue-400">{placement.yMm}</span>
          </div>
          <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400">Z (Cao): </span>
            <span className="font-bold text-blue-400">{placement.zMm}</span>
          </div>
        </div>
      </div>

      {/* Unloading Sequence & Stacking Badges */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono-numeric">
          <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-400" />
          <span>Thứ tự dỡ:</span>
          <span className="font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
            #{metadata.dropOrder ?? placement.layerIndex ?? 1}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {metadata.isFragile && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <ShieldAlert className="h-3 w-3" />
              Dễ vỡ
            </span>
          )}
          {metadata.noStack && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30">
              <Ban className="h-3 w-3" />
              Cấm đè
            </span>
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-800">
        <Button variant="outline" size="sm" className="w-full text-xs text-slate-300 border-slate-700 hover:bg-slate-800" onClick={onClose}>
          Bỏ chọn kiện này
        </Button>
      </div>
    </div>
  );
}
