'use client';

import React, { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api-client';

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
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadCompanies = async () => {
    try {
      const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;
      const data = await fetchApi<Company[]>('/companies', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setCompanies(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setActionLoading(id);
    setMessage(null);
    try {
      const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;
      await fetchApi(`/companies/${id}/status`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Bảng Điều Khiển Quản Trị Hệ Thống (Platform Admin)
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Duyệt doanh nghiệp mới, quản lý trạng thái tài khoản multi-tenant, và giám sát hạ tầng sàn.
        </p>
      </div>

      {message && (
        <div className="rounded-lg bg-blue-950/60 border border-blue-800/80 p-4 text-xs text-blue-200">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tổng Số Doanh Nghiệp
          </div>
          <div className="mt-2 text-3xl font-extrabold text-blue-400">
            {companies.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">Đăng ký trên nền tảng</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Doanh Nghiệp Đang Chờ Duyệt
          </div>
          <div className="mt-2 text-3xl font-extrabold text-amber-400">
            {companies.filter((c) => c.status === 'PENDING').length}
          </div>
          <div className="mt-1 text-xs text-slate-500">Cần xác minh MST & giấy phép</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Doanh Nghiệp Đã Duyệt (Active)
          </div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-400">
            {companies.filter((c) => c.status === 'VERIFIED').length}
          </div>
          <div className="mt-1 text-xs text-slate-500">Đầy đủ quyền hoạt động</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tài Khoản Bị Đình Chỉ (Suspended)
          </div>
          <div className="mt-2 text-3xl font-extrabold text-red-400">
            {companies.filter((c) => c.status === 'SUSPENDED').length}
          </div>
          <div className="mt-1 text-xs text-slate-500">Bị khóa phiên truy cập tức thì</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-white">
            Danh sách Doanh nghiệp & Phê duyệt trạng thái
          </h2>
          <button
            onClick={loadCompanies}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
          >
            Làm mới
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Đang tải dữ liệu...</div>
        ) : companies.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">Chưa có doanh nghiệp nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Tên Doanh Nghiệp</th>
                  <th className="px-4 py-3">Mã Số Thuế</th>
                  <th className="px-4 py-3">Loại Hình</th>
                  <th className="px-4 py-3">Người Đại Diện</th>
                  <th className="px-4 py-3">Trạng Thái</th>
                  <th className="px-4 py-3 rounded-r-lg text-right">Thao Tác Duyệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3.5 font-medium text-white">{c.name}</td>
                    <td className="px-4 py-3.5 font-mono">{c.taxCode}</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                        {c.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">{c.representativeName || '—'}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          c.status === 'VERIFIED'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                            : c.status === 'PENDING'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                            : c.status === 'SUSPENDED'
                            ? 'bg-red-950/60 text-red-300 border-red-800/60'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-2">
                      {c.status !== 'VERIFIED' && (
                        <button
                          disabled={actionLoading === c.id}
                          onClick={() => handleUpdateStatus(c.id, 'VERIFIED')}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition cursor-pointer disabled:opacity-50"
                        >
                          Duyệt
                        </button>
                      )}
                      {c.status !== 'SUSPENDED' && (
                        <button
                          disabled={actionLoading === c.id}
                          onClick={() => handleUpdateStatus(c.id, 'SUSPENDED')}
                          className="px-2.5 py-1 rounded bg-red-800 hover:bg-red-700 text-white font-medium transition cursor-pointer disabled:opacity-50"
                        >
                          Đình chỉ
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
