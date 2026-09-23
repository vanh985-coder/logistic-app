'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api-client';
import {
  Building2,
  FileText,
  User,
  Phone,
  MapPin,
  Mail,
  Lock,
  Layers,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { Button, Input, Select, Card, CardContent } from '@/components/ui';

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
    <div className="min-h-screen bg-surface-app flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-body font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center">
        <div className="inline-flex justify-center mb-4">
          <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center font-black text-2xl tracking-wider text-white shadow-md shadow-primary/20">
            <Layers className="h-6 w-6" />
          </div>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-title">
          Đăng Ký Tài Khoản Doanh Nghiệp
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-text-secondary">
          Khởi tạo tài khoản tổ chức trên nền tảng gom hàng LCL thông minh LOGIX-3D
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <Card className="shadow-sm border-border-subtle bg-surface-card">
          <CardContent className="p-6 sm:p-8">
            {error && (
              <div className="mb-6 rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700">
                <span className="font-semibold">Lỗi: </span>
                {error}
              </div>
            )}

            {success && (
              <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  <strong className="font-semibold">Đăng ký thành công!</strong> Đang chuyển hướng tới trang đăng nhập...
                </span>
              </div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Section 1: Company Info */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-subtle pb-2.5 mb-4">
                  1. Thông tin Doanh Nghiệp & Pháp Nhân
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Mã số thuế"
                    required
                    value={taxCode}
                    onChange={(e) => setTaxCode(e.target.value)}
                    placeholder="0101234567"
                    leftIcon={<FileText className="h-4 w-4" />}
                  />

                  <Select
                    label="Mô hình hoạt động"
                    required
                    value={companyType}
                    onChange={(e) => setCompanyType(e.target.value)}
                    leftIcon={<Building2 className="h-4 w-4" />}
                    options={[
                      { value: 'SHIPPER', label: 'Chủ hàng (Shipper)' },
                      { value: 'FWD', label: 'Giao nhận vận tải (Forwarder)' },
                      { value: 'CFS', label: 'Kho gom hàng (CFS Warehouse)' },
                    ]}
                  />

                  <div className="sm:col-span-2">
                    <Input
                      label="Tên doanh nghiệp"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Công ty Cổ phần Vận tải Logistics..."
                      leftIcon={<Building2 className="h-4 w-4" />}
                    />
                  </div>

                  <Input
                    label="Người đại diện pháp luật"
                    value={representativeName}
                    onChange={(e) => setRepresentativeName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    leftIcon={<User className="h-4 w-4" />}
                  />

                  <Input
                    label="Hotline doanh nghiệp"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    placeholder="024 3999 8888"
                    leftIcon={<Phone className="h-4 w-4" />}
                  />

                  <div className="sm:col-span-2">
                    <Input
                      label="Địa chỉ trụ sở chính"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Số 123 Đường ABC, Quận 1, TP. Hồ Chí Minh"
                      leftIcon={<MapPin className="h-4 w-4" />}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Admin User Info */}
              <div className="pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-subtle pb-2.5 mb-4">
                  2. Tài khoản Quản trị viên (Company Admin)
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Họ và tên người quản trị"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Trần Thị B"
                    leftIcon={<User className="h-4 w-4" />}
                  />

                  <Input
                    label="Số điện thoại cá nhân"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    placeholder="0912 345 678"
                    leftIcon={<Phone className="h-4 w-4" />}
                  />

                  <Input
                    label="Email công việc (Dùng đăng nhập)"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@company.com"
                    leftIcon={<Mail className="h-4 w-4" />}
                  />

                  <Input
                    label="Mật khẩu khởi tạo"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                    leftIcon={<Lock className="h-4 w-4" />}
                  />
                </div>
              </div>

              {/* In-flow action button */}
              <div className="pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  isLoading={loading}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Hoàn tất Đăng ký Doanh nghiệp
                </Button>
              </div>
            </form>

            <div className="mt-6 border-t border-border-subtle pt-5 text-center text-xs text-text-secondary">
              Đã có tài khoản doanh nghiệp?{' '}
              <Link
                href="/login"
                className="font-semibold text-primary hover:underline"
              >
                Đăng nhập ngay
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
