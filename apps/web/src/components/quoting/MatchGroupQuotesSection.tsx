'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import { useAuth } from '@/contexts/auth-context';
import {
  FileText,
  Plus,
  CheckCircle2,
  DollarSign,
  Calendar,
  Clock,
  Building2,
  LogOut,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  X,
} from 'lucide-react';
import { Button, Card, StatusBadge } from '@/components/ui';

interface ShipperAllocation {
  shipmentId: string;
  companyId: string;
  companyName?: string;
  trackingCode: string;
  volumeMm3: string;
  weightGrams: string;
  costShareBps: number;
  costSharePercent: number;
  allocatedAmount: string;
  breakdown: {
    oceanFreight: string;
    handlingFee: string;
    documentationFee: string;
    surcharges: string;
    vatAmount: string;
    totalAmount: string;
  };
}

interface QuoteDto {
  id: string;
  matchGroupId: string;
  fwdCompanyId: string;
  fwdCompany?: {
    id: string;
    name: string;
    taxCode: string;
  };
  status: string;
  oceanFreight: string;
  handlingFee: string;
  documentationFee: string;
  surcharges: string;
  vatRateBps: number;
  vatAmount: string;
  totalAmount: string;
  transitDays: number;
  validUntil: string;
  notes?: string;
  createdAt: string;
  booking?: {
    id: string;
    bookingNumber: string;
    status: string;
    confirmedAt?: string;
  };
  allocations: ShipperAllocation[];
  myAllocation?: ShipperAllocation | null;
}

interface MatchGroupQuotesSectionProps {
  matchGroupId: string;
  matchGroupStatus: string;
  shipments: any[];
}

export function MatchGroupQuotesSection({
  matchGroupId,
  matchGroupStatus,
  shipments,
}: MatchGroupQuotesSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isFwd = user?.role === 'FWD_ADMIN' || user?.role === 'FWD_OPERATOR';
  const isShipper = user?.role === 'SHIPPER_ADMIN' || user?.role === 'SHIPPER_MEMBER';
  const isPlatformAdmin = user?.role === 'PLATFORM_ADMIN' || user?.role === 'ADMIN';

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

  // Form State
  const [oceanFreight, setOceanFreight] = useState<number>(24000000);
  const [handlingFee, setHandlingFee] = useState<number>(2000000);
  const [documentationFee, setDocumentationFee] = useState<number>(500000);
  const [surcharges, setSurcharges] = useState<number>(500000);
  const [transitDays, setTransitDays] = useState<number>(3);
  const [validDays, setValidDays] = useState<number>(5);
  const [notes, setNotes] = useState<string>('Giá bao gồm vận chuyển đường biển và phí xếp dỡ hai đầu');

  // Fetch Quotes
  const { data: quotes, isLoading } = useQuery<QuoteDto[]>({
    queryKey: ['quotes', matchGroupId],
    queryFn: () => fetchApi<QuoteDto[]>(`/quotes?matchGroupId=${matchGroupId}`),
    staleTime: 5000,
  });

  // Calculations for Create Form
  const subtotal = oceanFreight + handlingFee + documentationFee + surcharges;
  const vatAmount = Math.round(subtotal * 0.1);
  const totalAmount = subtotal + vatAmount;

  // Create Quote Mutation
  const createQuoteMutation = useMutation({
    mutationFn: () => {
      const validUntil = new Date(Date.now() + validDays * 86400000).toISOString();
      return fetchApi('/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchGroupId,
          oceanFreight,
          handlingFee,
          documentationFee,
          surcharges,
          vatRateBps: 1000,
          transitDays,
          validUntil,
          notes,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes', matchGroupId] });
      queryClient.invalidateQueries({ queryKey: ['match-groups', matchGroupId] });
      setShowCreateForm(false);
      setActionMessage('Đã gửi báo giá container thành công!');
      setActionError(null);
      setTimeout(() => setActionMessage(null), 5000);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Lỗi khi gửi báo giá');
    },
  });

  // Accept Booking Mutation
  const acceptBookingMutation = useMutation({
    mutationFn: (quoteId: string) =>
      fetchApi(`/quotes/${quoteId}/accept-booking`, { method: 'POST' }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['quotes', matchGroupId] });
      queryClient.invalidateQueries({ queryKey: ['match-groups', matchGroupId] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setActionMessage(data.message || 'Đã chốt booking container thành công!');
      setActionError(null);
      setTimeout(() => setActionMessage(null), 5000);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Lỗi khi chốt booking');
    },
  });

  // Withdraw Shipment Mutation (for Shipper)
  const withdrawMutation = useMutation({
    mutationFn: (shipmentId: string) =>
      fetchApi(`/match-groups/${matchGroupId}/shipments/${shipmentId}/withdraw`, {
        method: 'POST',
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['match-groups', matchGroupId] });
      queryClient.invalidateQueries({ queryKey: ['quotes', matchGroupId] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setActionMessage(data.message || 'Đã rút lô hàng khỏi nhóm ghép!');
      setActionError(null);
      setTimeout(() => setActionMessage(null), 5000);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Lỗi khi rút hàng');
    },
  });

  // Find caller's shipment in this group
  const myShipments = shipments?.filter((s) => s.shipment?.companyId === user?.companyId) || [];

  return (
    <Card className="overflow-hidden bg-surface-card border-border-subtle shadow-sm">
      {/* Header */}
      <div className="p-5 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-title flex items-center gap-2">
                Báo Giá & Phân Bổ Chi Phí Container LCL
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Báo giá trọn gói từ FWD, phân bổ cước theo tỷ lệ benchmark Phase 2 không thất thoát 1 đồng.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {(isFwd || isPlatformAdmin) && matchGroupStatus === 'PROPOSED' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreateForm(!showCreateForm)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              {showCreateForm ? 'Đóng biểu mẫu' : 'Gửi Báo Giá FWD'}
            </Button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {actionMessage && (
        <div className="mx-5 mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="mx-5 mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Shipper Prominent Allocation Box */}
      {isShipper && quotes && quotes.length > 0 && quotes[0].myAllocation && (
        <div className="m-5 p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Phần Chi Phí Phân Bổ Của Bạn
              </span>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="text-2xl font-extrabold text-emerald-700 font-mono-numeric">
                  {Number(quotes[0].myAllocation.allocatedAmount).toLocaleString('vi-VN')} đ
                </span>
                <span className="text-xs font-semibold text-text-secondary">
                  (Chiếm {quotes[0].myAllocation.costSharePercent}% tổng cước container)
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                Được tính tự động theo tỷ lệ cước vận đơn Phase 2 (Cước biển, Handling, Chứng từ, Phụ phí &amp; VAT 10%).
              </p>
            </div>

            {/* Shipper Opt-out Button */}
            {myShipments.length > 0 && matchGroupStatus !== 'CLOSED' && matchGroupStatus !== 'CANCELLED' && (
              <div className="flex flex-col items-end gap-1">
                {myShipments.map((ms) => (
                  <Button
                    key={ms.shipmentId}
                    variant="outline"
                    size="sm"
                    className="border-rose-300 text-rose-600 hover:bg-rose-50 hover:border-rose-400 whitespace-nowrap"
                    onClick={() => {
                      if (confirm(`Bạn có chắc chắn muốn rút lô hàng ${ms.shipment?.trackingCode} khỏi nhóm ghép container này? Lô hàng sẽ quay về trạng thái Chờ gom hàng.`)) {
                        withdrawMutation.mutate(ms.shipmentId);
                      }
                    }}
                    isLoading={withdrawMutation.isPending}
                    leftIcon={<LogOut className="h-3.5 w-3.5" />}
                  >
                    Tách khỏi nhóm ({ms.shipment?.trackingCode})
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FWD Create Quote Form */}
      {showCreateForm && (
        <div className="p-5 m-5 rounded-2xl bg-surface-app border border-border-subtle space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-title flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Lập Báo Giá Vận Chuyển Nguyên Container (FCL/LCL Consol)
            </h3>
            <span className="text-xs text-text-secondary">Thuế GTGT: 10% (VAT)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Cước biển (Ocean Freight) VNĐ
              </label>
              <input
                type="number"
                step="500000"
                value={oceanFreight}
                onChange={(e) => setOceanFreight(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono-numeric rounded-lg border border-border-subtle bg-surface-card focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Phí handling VNĐ
              </label>
              <input
                type="number"
                step="100000"
                value={handlingFee}
                onChange={(e) => setHandlingFee(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono-numeric rounded-lg border border-border-subtle bg-surface-card focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Phí chứng từ (Doc Fee) VNĐ
              </label>
              <input
                type="number"
                step="50000"
                value={documentationFee}
                onChange={(e) => setDocumentationFee(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono-numeric rounded-lg border border-border-subtle bg-surface-card focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Phụ phí khác (Surcharges) VNĐ
              </label>
              <input
                type="number"
                step="50000"
                value={surcharges}
                onChange={(e) => setSurcharges(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono-numeric rounded-lg border border-border-subtle bg-surface-card focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Thời gian vận chuyển (ngày)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={transitDays}
                onChange={(e) => setTransitDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono-numeric rounded-lg border border-border-subtle bg-surface-card focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Hiệu lực báo giá (ngày kể từ hôm nay)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={validDays}
                onChange={(e) => setValidDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono-numeric rounded-lg border border-border-subtle bg-surface-card focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Ghi chú điều khoản vận chuyển
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Điều khoản giao nhận, lưu kho..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-border-subtle bg-surface-card focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Pricing Preview Summary */}
          <div className="p-4 rounded-xl bg-surface-card border border-border-subtle flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-xs">
              <div>
                <span className="text-text-secondary">Trước thuế:</span>{' '}
                <span className="font-bold text-title font-mono-numeric">
                  {subtotal.toLocaleString('vi-VN')} đ
                </span>
              </div>
              <div>
                <span className="text-text-secondary">Thuế VAT (10%):</span>{' '}
                <span className="font-bold text-title font-mono-numeric">
                  {vatAmount.toLocaleString('vi-VN')} đ
                </span>
              </div>
              <div>
                <span className="text-text-secondary">Tổng cộng cont:</span>{' '}
                <span className="font-extrabold text-emerald-600 text-sm font-mono-numeric">
                  {totalAmount.toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(false)}
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => createQuoteMutation.mutate()}
                isLoading={createQuoteMutation.isPending}
              >
                Gửi báo giá ngay
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quotes List Table */}
      {isLoading ? (
        <div className="py-12 text-center text-text-secondary text-xs">
          Đang tải danh sách báo giá...
        </div>
      ) : !quotes || quotes.length === 0 ? (
        <div className="py-12 text-center text-text-secondary text-xs">
          <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          Chưa có báo giá nào được gửi cho nhóm container này.
        </div>
      ) : (
        <div className="divide-y divide-border-subtle">
          {quotes.map((quote) => {
            const isExpanded = expandedQuoteId === quote.id;
            return (
              <div key={quote.id} className="p-5 transition hover:bg-surface-app/40">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* FWD Information & General Terms */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-title text-sm flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-primary" />
                        {quote.fwdCompany?.name || 'Công ty Forwarder'}
                      </span>
                      <StatusBadge status={quote.status} size="sm" />
                      {quote.booking && (
                        <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 text-[11px] font-mono-numeric font-bold">
                          Booking: {quote.booking.bookingNumber}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> Thời gian: {quote.transitDays} ngày
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> Hiệu lực đến:{' '}
                        {new Date(quote.validUntil).toLocaleDateString('vi-VN')}
                      </span>
                      {quote.notes && <span className="italic">"{quote.notes}"</span>}
                    </div>
                  </div>

                  {/* Pricing Breakdown Summary */}
                  <div className="flex flex-wrap items-center gap-4 text-right">
                    <div className="text-right">
                      <div className="text-[11px] text-text-secondary">Tổng cước container (gồm VAT)</div>
                      <div className="text-lg font-extrabold text-emerald-600 font-mono-numeric">
                        {Number(quote.totalAmount).toLocaleString('vi-VN')} đ
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedQuoteId(isExpanded ? null : quote.id)}
                        rightIcon={isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      >
                        {isExpanded ? 'Ẩn phân bổ' : 'Xem phân bổ'}
                      </Button>

                      {/* Confirm Booking Button for FWD */}
                      {(isFwd || isPlatformAdmin) && quote.status === 'PENDING' && matchGroupStatus === 'PROPOSED' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Xác nhận chốt booking container với báo giá ${Number(quote.totalAmount).toLocaleString('vi-VN')} đ? Nhóm ghép sẽ chuyển sang trạng thái CONFIRMED.`)) {
                              acceptBookingMutation.mutate(quote.id);
                            }
                          }}
                          isLoading={acceptBookingMutation.isPending}
                          leftIcon={<CheckCircle2 className="h-4 w-4" />}
                        >
                          Chốt booking
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Proportional Breakdown Section */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border-subtle/80 space-y-4">
                    {/* Component Breakdown Badges */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-surface-card border border-border-subtle">
                        Cước biển:{' '}
                        <strong className="font-mono-numeric text-title">
                          {Number(quote.oceanFreight).toLocaleString('vi-VN')} đ
                        </strong>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-surface-card border border-border-subtle">
                        Handling:{' '}
                        <strong className="font-mono-numeric text-title">
                          {Number(quote.handlingFee).toLocaleString('vi-VN')} đ
                        </strong>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-surface-card border border-border-subtle">
                        Chứng từ:{' '}
                        <strong className="font-mono-numeric text-title">
                          {Number(quote.documentationFee).toLocaleString('vi-VN')} đ
                        </strong>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-surface-card border border-border-subtle">
                        Phụ phí:{' '}
                        <strong className="font-mono-numeric text-title">
                          {Number(quote.surcharges).toLocaleString('vi-VN')} đ
                        </strong>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-surface-card border border-border-subtle">
                        VAT (10%):{' '}
                        <strong className="font-mono-numeric text-title">
                          {Number(quote.vatAmount).toLocaleString('vi-VN')} đ
                        </strong>
                      </span>
                    </div>

                    {/* Proportional Allocations Table */}
                    <div className="overflow-x-auto rounded-xl border border-border-subtle">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-surface-app text-text-secondary uppercase text-[10px] font-semibold border-b border-border-subtle">
                          <tr>
                            <th className="py-2.5 px-4">Chủ hàng (Shipper)</th>
                            <th className="py-2.5 px-4">Mã Vận Đơn</th>
                            <th className="py-2.5 px-4 text-center">Tỷ trọng chi phí</th>
                            <th className="py-2.5 px-4 text-right">Cước biển</th>
                            <th className="py-2.5 px-4 text-right">Handling</th>
                            <th className="py-2.5 px-4 text-right">Chứng từ + Phụ phí</th>
                            <th className="py-2.5 px-4 text-right">VAT (10%)</th>
                            <th className="py-2.5 px-4 text-right">Tổng phân bổ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                          {quote.allocations.map((alloc) => {
                            const isMine = alloc.companyId === user?.companyId;
                            return (
                              <tr
                                key={alloc.shipmentId}
                                className={isMine ? 'bg-emerald-50/50 font-semibold' : 'hover:bg-surface-app/30'}
                              >
                                <td className="py-2.5 px-4 text-title">
                                  {alloc.companyName || 'Shipper'} {isMine && <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-normal">(Của bạn)</span>}
                                </td>
                                <td className="py-2.5 px-4 font-mono-numeric text-text-secondary">
                                  {alloc.trackingCode}
                                </td>
                                <td className="py-2.5 px-4 text-center font-mono-numeric text-title">
                                  {alloc.costSharePercent}%
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono-numeric text-text-secondary">
                                  {Number(alloc.breakdown.oceanFreight).toLocaleString('vi-VN')} đ
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono-numeric text-text-secondary">
                                  {Number(alloc.breakdown.handlingFee).toLocaleString('vi-VN')} đ
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono-numeric text-text-secondary">
                                  {(
                                    Number(alloc.breakdown.documentationFee) +
                                    Number(alloc.breakdown.surcharges)
                                  ).toLocaleString('vi-VN')}{' '}
                                  đ
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono-numeric text-text-secondary">
                                  {Number(alloc.breakdown.vatAmount).toLocaleString('vi-VN')} đ
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono-numeric text-emerald-600 font-bold">
                                  {Number(alloc.allocatedAmount).toLocaleString('vi-VN')} đ
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
