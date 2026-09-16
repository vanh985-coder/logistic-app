'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { fetchApi } from '@/lib/api-client';

interface UserInfo {
  id: string;
  email: string;
  fullName: string;
  role: string;
  companyId: string;
  companyName: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('user');
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const handleLogout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }
    router.push('/login');
  };

  const navItems = [
    { label: 'Chủ hàng (Shipper)', href: '/dashboard/shipper', rolePrefix: 'SHIPPER' },
    { label: 'Giao nhận (Forwarder)', href: '/dashboard/fwd', rolePrefix: 'FWD' },
    { label: 'Kho gom hàng (CFS)', href: '/dashboard/cfs', rolePrefix: 'CFS' },
    { label: 'Quản trị sàn (Admin)', href: '/dashboard/admin', rolePrefix: 'ADMIN' },
  ];

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
              const isActive = pathname.startsWith(item.href);
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
              {user?.fullName || user?.email || 'Người dùng'}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {user?.companyName || 'Công ty'}
            </div>
            <div className="mt-1.5 inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-900/60 text-blue-300 border border-blue-700/50">
              {user?.role || 'MEMBER'}
            </div>
          </div>
          <button
            onClick={handleLogout}
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
