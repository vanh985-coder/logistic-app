'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { getNavItemsForRole, isRouteAllowedForRole, getDefaultDashboardForRole } from '@/lib/auth-utils';
import { RefreshCw, LogOut, Layers } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated, logout } = useAuth();

  // Route Guard: enforce strict RBAC redirection
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      router.replace('/login');
      return;
    }

    if (!isRouteAllowedForRole(pathname, user.role)) {
      const fallbackUrl = getDefaultDashboardForRole(user.role);
      router.replace(fallbackUrl);
    }
  }, [isLoading, isAuthenticated, user, pathname, router]);

  // If loading or unauthorized route, do not render children
  if (isLoading || !user || !isRouteAllowedForRole(pathname, user.role)) {
    return (
      <div className="min-h-screen bg-surface-app flex flex-col items-center justify-center text-text-secondary">
        <RefreshCw className="h-7 w-7 animate-spin text-primary mb-3" />
        <div className="text-xs font-medium">Đang khôi phục phiên làm việc...</div>
      </div>
    );
  }

  const navItems = getNavItemsForRole(user.role);

  return (
    <div className="min-h-screen bg-surface-app text-body flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-surface-card border-r border-border-subtle flex flex-col justify-between p-4 shadow-sm z-10">
        <div>
          {/* Logo */}
          <div className="flex items-center space-x-3 px-2 py-4 mb-4 border-b border-border-subtle">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center font-black text-white shadow-md shadow-primary/20">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="font-extrabold text-sm tracking-wide text-title">LOGIX-3D</div>
              <div className="text-[10px] text-text-secondary font-medium">Multi-tenant LCL SaaS</div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-2">
              Không gian làm việc
            </div>
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-3.5 py-2.5 text-xs font-medium rounded-xl transition duration-150 whitespace-nowrap ${
                    isActive
                      ? 'bg-primary text-white font-semibold shadow-sm shadow-primary/20'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-title'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile & Logout */}
        <div className="border-t border-border-subtle pt-4 mt-6">
          <div className="px-3 py-2.5 rounded-xl bg-surface-subtle border border-border-subtle mb-3">
            <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
              Tài khoản hiện tại
            </div>
            <div className="text-xs font-semibold text-title truncate">
              {user.fullName || user.email}
            </div>
            <div className="text-[11px] text-text-secondary truncate mt-0.5">
              {user.companyName || 'Doanh nghiệp'}
            </div>
            <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary-tint text-primary border border-blue-200 font-mono-numeric">
              Vai trò: {user.role}
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl transition border border-rose-200 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-surface-app">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
