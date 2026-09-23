import React from 'react';
import { ShipmentStatus, MatchGroupStatus } from '@logix/shared';

export type SemanticStatus =
  | ShipmentStatus
  | MatchGroupStatus
  | 'DRAFT'
  | 'PENDING'
  | 'VERIFIED'
  | 'READY'
  | 'PRICED'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'MATCHED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'
  | string;

interface StatusBadgeProps {
  status: SemanticStatus;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  className = '',
  showDot = true,
}) => {
  const normalizedStatus = String(status).toUpperCase();

  // Mapping from status to visual styles and localized labels
  let text = label;
  let bgClass = 'bg-[#F1F5F9]';
  let textClass = 'text-[#475569]';
  let borderClass = 'border-[#CBD5E1]';
  let dotClass = 'bg-[#475569]';

  switch (normalizedStatus) {
    case 'DRAFT':
      text = text || 'Bản nháp';
      bgClass = 'bg-[#F1F5F9]';
      textClass = 'text-[#475569]';
      borderClass = 'border-[#CBD5E1]';
      dotClass = 'bg-[#64748B]';
      break;

    case 'PENDING':
    case 'VERIFYING':
      text = text || 'Đang xác minh';
      bgClass = 'bg-[#FEF5E4]';
      textClass = 'text-[#D97706]';
      borderClass = 'border-[#FDE68A]';
      dotClass = 'bg-[#D97706]';
      break;

    case 'VERIFIED':
      text = text || 'Đã xác minh';
      bgClass = 'bg-[#DAF6F9]';
      textClass = 'text-[#23A19E]';
      borderClass = 'border-[#A5F3FC]';
      dotClass = 'bg-[#23A19E]';
      break;

    case 'READY':
      text = text || 'Sẵn sàng sử dụng';
      bgClass = 'bg-[#FEF5E4]';
      textClass = 'text-[#D97706]';
      borderClass = 'border-[#FDE68A]';
      dotClass = 'bg-[#D97706]';
      break;

    case 'PRICED':
      text = text || 'Đã báo giá';
      bgClass = 'bg-[#E0F6FD]';
      textClass = 'text-[#0284C7]';
      borderClass = 'border-[#7DD3FC]';
      dotClass = 'bg-[#0284C7]';
      break;

    case 'SUBMITTED':
      text = text || 'Chờ gom hàng';
      bgClass = 'bg-[#FFF7ED]';
      textClass = 'text-[#FD791C]';
      borderClass = 'border-[#FED7AA]';
      dotClass = 'bg-[#FD791C]';
      break;

    case 'CONFIRMED':
      text = text || 'Đã xác nhận';
      bgClass = 'bg-[#CCFBF1]';
      textClass = 'text-[#0F766E]';
      borderClass = 'border-[#5EEAD4]';
      dotClass = 'bg-[#0F766E]';
      break;

    case 'MATCHED':
      text = text || 'Đã ghép cont';
      bgClass = 'bg-[#DCFCE7]';
      textClass = 'text-[#16A34A]';
      borderClass = 'border-[#86EFAC]';
      dotClass = 'bg-[#16A34A]';
      break;

    case 'IN_TRANSIT':
      text = text || 'Đang vận chuyển';
      bgClass = 'bg-[#F0FDF4]';
      textClass = 'text-[#168168]';
      borderClass = 'border-[#A7F3D0]';
      dotClass = 'bg-[#168168]';
      break;

    case 'DELIVERED':
      text = text || 'Đã giao hàng';
      bgClass = 'bg-[#DCFCE7]';
      textClass = 'text-[#16A34A]';
      borderClass = 'border-[#86EFAC]';
      dotClass = 'bg-[#16A34A]';
      break;

    case 'ACCEPTED':
      text = text || 'Đã chấp nhận';
      bgClass = 'bg-[#DCFCE7]';
      textClass = 'text-[#16A34A]';
      borderClass = 'border-[#86EFAC]';
      dotClass = 'bg-[#16A34A]';
      break;

    case 'REJECTED':
      text = text || 'Bị từ chối';
      bgClass = 'bg-[#FFE4E6]';
      textClass = 'text-[#BE123C]';
      borderClass = 'border-[#FDA4AF]';
      dotClass = 'bg-[#BE123C]';
      break;

    case 'EXPIRED':
      text = text || 'Hết hiệu lực';
      bgClass = 'bg-[#F1F5F9]';
      textClass = 'text-[#64748B]';
      borderClass = 'border-[#CBD5E1]';
      dotClass = 'bg-[#64748B]';
      break;

    case 'RECEIVED_CFS':
      text = text || 'Đã nhận tại CFS';
      bgClass = 'bg-[#EDE9FE]';
      textClass = 'text-[#7C3AED]';
      borderClass = 'border-[#DDD6FE]';
      dotClass = 'bg-[#7C3AED]';
      break;

    case 'SEALED':
      text = text || 'Đã kẹp chì / Đóng cont';
      bgClass = 'bg-[#E0E7FF]';
      textClass = 'text-[#4338CA]';
      borderClass = 'border-[#C7D2FE]';
      dotClass = 'bg-[#4338CA]';
      break;

    case 'CANCELLED':
      text = text || 'Đã hủy';
      bgClass = 'bg-[#FFE4E6]';
      textClass = 'text-[#BE123C]';
      borderClass = 'border-[#FDA4AF]';
      dotClass = 'bg-[#BE123C]';
      break;

    default:
      text = text || status;
      break;
  }

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[11px] gap-1.5'
      : 'px-2.5 py-1 text-xs gap-2';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border whitespace-nowrap ${bgClass} ${textClass} ${borderClass} ${sizeClasses} ${className}`}
    >
      {showDot && (
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      )}
      <span className="leading-none">{text}</span>
    </span>
  );
};
