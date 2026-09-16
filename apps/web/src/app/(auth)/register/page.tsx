'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api-client';

export default function RegisterPage() {
  const router = useRouter();

  // Company info
  const [taxCode, setTaxCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState('SHIPPER');
  const [representativeName, setRepresentativeName] = useState('');
  const [address, setAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');

  // Admin user info
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userPhone, setUserPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await fetchApi('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          taxCode,
          companyName,
          companyType,
          representativeName,
          address,
          companyPhone,
          fullName,
          email,
          password,
          phone: userPhone,
        }),
      });

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Đăng ký không thành công. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center font-black text-2xl tracking-wider text-white shadow-lg shadow-blue-500/30">
            L3D
          </div>
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold tracking-tight text-white">
          Đăng Ký Doanh Nghiệp Mới
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Khởi tạo tài khoản tổ chức trên nền tảng LOGIX-3D
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-slate-900/80 backdrop-blur-md py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-800">
          {error && (
            <div className="mb-6 rounded-lg bg-red-950/60 border border-red-800/80 p-4 text-sm text-red-200">
              <span className="font-semibold">Lỗi: </span>
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 rounded-lg bg-emerald-950/60 border border-emerald-800/80 p-4 text-sm text-emerald-200">
              <span className="font-semibold">Đăng ký thành công!</span> Đang chuyển hướng tới trang đăng nhập...
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400 border-b border-slate-800 pb-2 mb-4">
                1. Thông tin Doanh Nghiệp
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Mã số thuế *
                  </label>
                  <input
                    type="text"
                    required
                    value={taxCode}
                    onChange={(e) => setTaxCode(e.target.value)}
                    placeholder="0101234567"
                    className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Mô hình hoạt động *
                  </label>
                  <select
                    value={companyType}
                    onChange={(e) => setCompanyType(e.target.value)}
                    className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="SHIPPER">Chủ hàng (Shipper)</option>
                    <option value="FWD">Giao nhận vận tải (Forwarder)</option>
                    <option value="CFS">Kho gom hàng (CFS Warehouse)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Tên doanh nghiệp *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Công ty Cổ phần Vận tải Logistics..."
                    className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Người đại diện pháp luật
                  </label>
                  <input
                    type="text"
                    value={representativeName}
                    onChange={(e) => setRepresentativeName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Hotline doanh nghiệp
                  </label>
                  <input
                    type="text"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    placeholder="024 3999 8888"
                    className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Địa chỉ trụ sở chính
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Số 123 Đường ABC, Quận 1, TP. Hồ Chí Minh"
                    className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400 border-b border-slate-800 pb-2 mb-4">
                2. Tài khoản Quản trị viên (Company Admin)
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Họ và tên *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Trần Thị B"
                    className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Số điện thoại cá nhân
                  </label>
                  <input
                    type="text"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    placeholder="0912 345 678"
                    className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Email công việc (Dùng đăng nhập) *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Mật khẩu khởi tạo *
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                    className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? 'Đang khởi tạo tài khoản...' : 'Hoàn tất Đăng ký Doanh nghiệp'}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-slate-800 pt-6 text-center text-xs text-slate-400">
            Đã có tài khoản?{' '}
            <Link
              href="/login"
              className="font-medium text-blue-400 hover:text-blue-300 transition"
            >
              Đăng nhập ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
