'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { getNavItemsForRole, isRouteAllowedForRole, getDefaultDashboardForRole } from '@/lib/auth-utils';
import { RefreshCw } from 'lucide-react';

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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <RefreshCw className="h-7 w-7 animate-spin text-blue-500 mb-3" />
        <div className="text-xs">Đang khôi phục phiên làm việc...</div>
      </div>
    );
  }

  const navItems = getNavItemsForRole(user.role);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4">
        <div>
          {/* Logo */}
          <div className="flex items-center space-x-3 px-2 py-4 mb-4 border-b border-slate-800">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
              L3D
            </div>
            <div>
              <div className="font-extrabold text-sm tracking-wide text-white">LOGIX-3D</div>
              <div className="text-[10px] text-slate-400">Multi-tenant SaaS</div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Không gian làm việc
            </div>
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-xs font-medium rounded-lg transition ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile & Logout */}
        <div className="border-t border-slate-800 pt-4 mt-6">
          <div className="px-3 py-2 rounded-lg bg-slate-800/60 mb-3">
            <div className="text-xs font-semibold text-white truncate">
              {user.fullName || user.email}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {user.companyName || 'Doanh nghiệp'}
            </div>
            <div className="mt-1.5 inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-900/60 text-blue-300 border border-blue-700/50 font-mono">
              {user.role}
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center py-2 px-3 text-xs font-medium text-red-400 hover:bg-red-950/40 hover:text-red-300 rounded-lg transition border border-red-900/40 cursor-pointer"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950">
        {children}
      </main>
    </div>
  );
}
