'use client';

import React, { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api-client';
import { useAuth } from '@/contexts/auth-context';
import { UserRole } from '@logix/shared';
import { RefreshCw, Building2, CheckCircle2, AlertCircle, XCircle, LayoutDashboard } from 'lucide-react';
import { Button, StatusBadge, Card, EmptyState } from '@/components/ui';

interface Company {
  id: string;
  name: string;
  taxCode: string;
  type: string;
  status: string;
  representativeName: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadCompanies = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<Company[]>('/companies');
      setCompanies(data);
    } catch (err: any) {
      setError(err.message || 'Không có quyền truy cập danh sách doanh nghiệp.');
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === UserRole.PLATFORM_ADMIN) {
      loadCompanies();
    } else {
      setLoading(false);
      setError('Tài khoản không có quyền PLATFORM_ADMIN.');
    }
  }, [user]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setActionLoading(id);
    setMessage(null);
    try {
      await fetchApi(`/companies/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setMessage(`Cập nhật trạng thái công ty thành công sang ${newStatus}!`);
      await loadCompanies();
    } catch (err: any) {
      setMessage(`Lỗi: ${err.message || 'Không thể cập nhật trạng thái'}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-title flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            Bảng Điều Khiển Quản Trị Hệ Thống (Platform Admin)
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Duyệt doanh nghiệp mới, quản lý trạng thái tài khoản multi-tenant, và giám sát hạ tầng sàn.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadCompanies}
          isLoading={loading}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Làm mới
        </Button>
      </div>

      {message && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-xs text-primary font-medium flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700 font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span><strong className="font-semibold">Lỗi: </strong>{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 bg-surface-card border-border-subtle shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Tổng Số Doanh Nghiệp
          </div>
          <div className="mt-2 text-3xl font-extrabold text-title font-mono-numeric">
            {companies.length}
          </div>
          <div className="mt-1 text-xs text-text-muted">Đăng ký trên nền tảng</div>
        </Card>

        <Card className="p-5 bg-surface-card border-border-subtle shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Đang Chờ Xác Minh
          </div>
          <div className="mt-2 text-3xl font-extrabold text-amber-600 font-mono-numeric">
            {companies.filter((c) => c.status === 'PENDING').length}
          </div>
          <div className="mt-1 text-xs text-text-muted">Cần xác minh MST & giấy phép</div>
        </Card>

        <Card className="p-5 bg-surface-card border-border-subtle shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Đã Xác Minh (Active)
          </div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-600 font-mono-numeric">
            {companies.filter((c) => c.status === 'VERIFIED').length}
          </div>
          <div className="mt-1 text-xs text-text-muted">Đầy đủ quyền hoạt động</div>
        </Card>

        <Card className="p-5 bg-surface-card border-border-subtle shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Bị Đình Chỉ (Suspended)
          </div>
          <div className="mt-2 text-3xl font-extrabold text-rose-600 font-mono-numeric">
            {companies.filter((c) => c.status === 'SUSPENDED').length}
          </div>
          <div className="mt-1 text-xs text-text-muted">Bị khóa phiên truy cập</div>
        </Card>
      </div>

      {/* Companies Table Card */}
      <Card className="p-6 bg-surface-card border-border-subtle shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-title flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Danh Sách Doanh Nghiệp & Phê Duyệt Trạng Thái
          </h2>
        </div>

        {error ? (
          <div className="py-8 text-center text-xs text-rose-600">
            Không thể tải danh sách do không có quyền hoặc có lỗi xảy ra.
          </div>
        ) : loading ? (
          <div className="py-8 text-center text-xs text-text-secondary">Đang tải dữ liệu...</div>
        ) : companies.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-7 w-7 text-primary" />}
            title="Chưa có doanh nghiệp nào"
            description="Chưa có doanh nghiệp nào đăng ký trong hệ thống."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-app text-text-secondary uppercase text-[11px] font-semibold border-b border-border-subtle">
                <tr>
                  <th className="px-4 py-3">Tên Doanh Nghiệp</th>
                  <th className="px-4 py-3">Mã Số Thuế</th>
                  <th className="px-4 py-3">Loại Hình</th>
                  <th className="px-4 py-3">Người Đại Diện</th>
                  <th className="px-4 py-3 text-center">Trạng Thái</th>
                  <th className="px-4 py-3 text-right">Thao Tác Duyệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-app transition-colors">
                    <td className="px-4 py-3.5 font-semibold text-title">{c.name}</td>
                    <td className="px-4 py-3.5 font-mono-numeric text-body">{c.taxCode}</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-subtle border border-border-subtle text-text-secondary">
                        {c.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-body">{c.representativeName || '—'}</td>
                    <td className="px-4 py-3.5 text-center">
                      <StatusBadge status={c.status} size="sm" />
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-2 whitespace-nowrap">
                      {c.status !== 'VERIFIED' && (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={actionLoading === c.id}
                          isLoading={actionLoading === c.id}
                          onClick={() => handleUpdateStatus(c.id, 'VERIFIED')}
                          leftIcon={<CheckCircle2 className="h-3 w-3" />}
                        >
                          Duyệt
                        </Button>
                      )}
                      {c.status !== 'SUSPENDED' && (
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={actionLoading === c.id}
                          isLoading={actionLoading === c.id}
                          onClick={() => handleUpdateStatus(c.id, 'SUSPENDED')}
                          leftIcon={<XCircle className="h-3 w-3" />}
                        >
                          Đình chỉ
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
