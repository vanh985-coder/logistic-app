import React from 'react';
import { UnplacedPackage, PackageMetadata } from './types';
import { CheckCircle2, AlertOctagon } from 'lucide-react';

interface UnplacedPackagesCardProps {
  unplaced: UnplacedPackage[];
  packagesMap: Map<string, PackageMetadata>;
  totalPlaced: number;
}

const REASON_LABELS: Record<string, { label: string; desc: string }> = {
  EXCEED_DIMENSIONS: {
    label: 'Vượt kích thước vỏ cont',
    desc: 'Kích thước kiện lớn hơn cửa hoặc không gian lọt lòng container.',
  },
  EXCEED_PAYLOAD: {
    label: 'Vượt tải trọng container',
    desc: 'Khối lượng kiện làm tổng tải vượt mức tối đa cho phép.',
  },
  NO_SUPPORT: {
    label: 'Không đủ diện tích đỡ đáy (<80%)',
    desc: 'Không tìm thấy vị trí có diện tích tiếp xúc mặt dưới an toàn.',
  },
  MAX_STACK_WEIGHT_EXCEEDED: {
    label: 'Vượt sức chịu tải đè đáy',
    desc: 'Khối lượng các kiện bên trên vượt giới hạn chịu lực của kiện dưới.',
  },
  NO_VALID_PLACEMENT: {
    label: 'Không còn không gian vừa vặn',
    desc: 'Các điểm cực trị Extreme Points còn lại không đủ khoảng trống.',
  },
  TIME_BUDGET_EXCEEDED: {
    label: 'Hết ngân sách thời gian tính',
    desc: 'Thuật toán kết thúc giới hạn vòng lặp đánh giá an toàn.',
  },
};

export function UnplacedPackagesCard({
  unplaced,
  packagesMap,
  totalPlaced,
}: UnplacedPackagesCardProps) {
  if (unplaced.length === 0) {
    return (
      <div className="rounded-xl bg-emerald-950/30 border border-emerald-800/40 p-3.5 text-emerald-300 text-xs flex items-center gap-2.5">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
        <span>
          <strong>100% Khả Thi:</strong> Toàn bộ <strong>{totalPlaced}</strong> kiện hàng đã được sắp xếp thành công vào container theo đúng tiêu chuẩn trọng tâm và chịu tải.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-900 border border-rose-900/50 p-4 text-slate-100 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
          <AlertOctagon className="h-4 w-4 shrink-0" />
          <span>Kiện Hàng Chưa Thể Xếp ({unplaced.length} kiện)</span>
        </div>
        <span className="text-[11px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
          Cần chuyển container tiếp theo
        </span>
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        Các kiện hàng dưới đây không thỏa mãn điều kiện vật lý (kích thước, chịu lực, điểm đỡ đáy). Hệ thống đề xuất lưu giữ để ghép vào đợt container kế tiếp.
      </p>

      <div className="max-h-48 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/60 text-xs">
        {unplaced.map((item, idx) => {
          const meta = packagesMap.get(item.packageId);
          const reasonInfo = REASON_LABELS[item.reason] || {
            label: item.reason,
            desc: 'Không thể xếp kiện',
          };

          return (
            <div key={idx} className="pt-2 first:pt-0 flex items-start justify-between gap-3">
              <div>
                <div className="font-mono font-bold text-slate-200">
                  {meta ? meta.packageCode : item.packageId}
                </div>
                {meta && (
                  <div className="text-[11px] text-slate-400 font-mono-numeric">
                    {meta.lengthMm}×{meta.widthMm}×{meta.heightMm} mm • {(meta.weightGrams / 1000).toFixed(1)} kg • {meta.companyName}
                  </div>
                )}
                <div className="text-[10px] text-slate-500 mt-0.5">{reasonInfo.desc}</div>
              </div>

              <span className="shrink-0 text-[10px] font-medium px-2 py-1 rounded bg-rose-950/60 border border-rose-800/60 text-rose-300">
                {reasonInfo.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
