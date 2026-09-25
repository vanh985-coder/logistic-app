'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api-client';
import { useAuth } from '@/contexts/auth-context';
import { getDefaultDashboardForRole } from '@/lib/auth-utils';
import { Mail, Lock, Layers, ArrowRight } from 'lucide-react';
import { Button, Input, Card, CardContent } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await fetchApi<{
        accessToken: string;
        user: {
          id: string;
          email: string;
          fullName: string;
          role: string;
          companyId: string;
          companyName: string;
        };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      // Save credentials into unified AuthContext and storage
      login(data.accessToken, data.user);

      // Route based on redirect param or default dashboard for role
      const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const redirectUrl = searchParams?.get('redirect');
      if (redirectUrl && redirectUrl.startsWith('/') && !redirectUrl.startsWith('//')) {
        router.push(redirectUrl);
      } else {
        const targetDashboard = getDefaultDashboardForRole(data.user.role);
        router.push(targetDashboard);
      }
    } catch (err: any) {
      setError(err.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-app flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-body font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex justify-center mb-4">
          <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center font-black text-2xl tracking-wider text-white shadow-md shadow-primary/20">
            <Layers className="h-6 w-6" />
          </div>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-title">
          Đăng nhập LOGIX-3D
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-text-secondary">
          Nền tảng gom hàng LCL thông minh & tối ưu xếp container 3D
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="shadow-sm border-border-subtle bg-surface-card">
          <CardContent className="p-6 sm:p-8">
            {error && (
              <div className="mb-5 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700">
                <span className="font-semibold">Lỗi: </span>{error}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                label="Email đăng nhập"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                leftIcon={<Mail className="h-4 w-4" />}
              />

              <Input
                label="Mật khẩu"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                leftIcon={<Lock className="h-4 w-4" />}
              />

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-text-secondary select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border-input text-primary focus:ring-primary/20"
                  />
                  <span>Ghi nhớ phiên đăng nhập</span>
                </label>

                <a href="#" className="font-medium text-primary hover:underline">
                  Quên mật khẩu?
                </a>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full"
                  isLoading={loading}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Đăng nhập
                </Button>
              </div>
            </form>

            <div className="mt-6 border-t border-border-subtle pt-5 text-center text-xs text-text-secondary">
              Chưa có tài khoản doanh nghiệp?{' '}
              <Link
                href="/register"
                className="font-semibold text-primary hover:underline"
              >
                Đăng ký tài khoản mới
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
