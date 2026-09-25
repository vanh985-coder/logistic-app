'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { getDefaultDashboardForRole } from '@/lib/auth-utils';
import {
  Box,
  ArrowRight,
  Maximize2,
  Scale,
  ShieldCheck,
  TrendingDown,
  Menu,
  X,
  LayoutDashboard,
} from 'lucide-react';

export default function LandingPage() {
  const { user, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const dashboardUrl = getDefaultDashboardForRole(user?.role);
  const shipmentsUrl = isAuthenticated ? '/shipments' : '/login?redirect=/shipments';
  const matchGroupsUrl = isAuthenticated ? '/match-groups' : '/login?redirect=/match-groups';
  const startCtaUrl = isAuthenticated ? dashboardUrl : '/login';

  return (
    <div className="relative min-h-screen w-full overflow-hidden text-white font-sans flex flex-col justify-between select-none">
      {/* 1. Ảnh nền toàn màn hình với next/image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/hero-bg.jpg"
          alt="Cảng biển vận tải logistics với container hàng hóa và tàu biển LOGIX-3D"
          fill
          priority
          quality={90}
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Lớp gradient xanh đậm mờ bên trái để chữ trắng đọc rõ */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#071328]/95 via-[#0A192F]/85 to-[#071328]/40 lg:to-transparent" />
        {/* Lớp phủ chuyển tiếp tương phản sáng tối trên dưới */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/75 pointer-events-none" />
      </div>

      {/* 2. Thanh điều hướng trên cùng (Header) */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        <div className="flex items-center justify-between">
          {/* Góc trên trái: Logo LOGIX-3D */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30 transition-transform duration-200 group-hover:scale-105">
              <Box className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-black tracking-wider text-white">
                LOGIX<span className="text-cyan-400">-3D</span>
              </span>
              <span className="text-[10px] tracking-widest text-slate-400 uppercase -mt-1 font-medium">
                Tối ưu container 3D
              </span>
            </div>
          </Link>

          {/* Góc trên phải: 4 nút điều hướng trên Desktop */}
          <nav className="hidden md:flex items-center gap-2">
            <Link
              href={shipmentsUrl}
              className="text-sm font-semibold text-slate-200 hover:text-white px-3.5 py-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              Lô hàng LCL
            </Link>

            <Link
              href={matchGroupsUrl}
              className="text-sm font-semibold text-slate-200 hover:text-white px-3.5 py-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              Nhóm ghép Container
            </Link>

            <div className="h-5 w-px bg-white/20 mx-1.5" />

            {isAuthenticated ? (
              <Link
                href={dashboardUrl}
                className="inline-flex items-center gap-2 text-sm font-bold text-white bg-primary hover:bg-primary-hover px-4 py-2 rounded-xl shadow-md shadow-primary/30 transition"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Vào hệ thống</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-semibold text-slate-200 hover:text-white px-3.5 py-2 rounded-xl hover:bg-white/10 transition"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-xl transition shadow-sm backdrop-blur-sm"
                >
                  Đăng ký
                </Link>
              </>
            )}
          </nav>

          {/* Nút bật Menu trên Mobile */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition backdrop-blur-sm border border-white/10"
              aria-label="Mở menu điều hướng"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Khung menu mở rộng trên Mobile */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 p-4 rounded-2xl bg-[#0A192F]/95 border border-white/10 shadow-2xl backdrop-blur-md flex flex-col gap-2.5 animate-in fade-in duration-150">
            <Link
              href={shipmentsUrl}
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-200 hover:text-white hover:bg-white/10 transition"
            >
              Lô hàng LCL
            </Link>
            <Link
              href={matchGroupsUrl}
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-200 hover:text-white hover:bg-white/10 transition"
            >
              Nhóm ghép Container
            </Link>

            <div className="h-px bg-white/10 my-1" />

            {isAuthenticated ? (
              <Link
                href={dashboardUrl}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 text-sm font-bold text-white bg-primary hover:bg-primary-hover px-4 py-3 rounded-xl shadow-md transition"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Vào hệ thống</span>
              </Link>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center text-sm font-semibold text-white bg-white/10 hover:bg-white/20 px-3.5 py-2.5 rounded-xl transition border border-white/10"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center text-sm font-semibold text-white bg-primary hover:bg-primary-hover px-3.5 py-2.5 rounded-xl transition shadow-md"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* 3. Giữa bên trái: Hero Content */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 my-auto flex flex-col justify-center">
        <div className="max-w-2xl text-left">
          {/* Dòng nhỏ chữ hoa giãn cách */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-400 text-xs sm:text-sm font-bold tracking-[0.2em] uppercase mb-4 sm:mb-6 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            LOGISTICS THÔNG MINH — HIỆU QUẢ VƯỢT TRỘI
          </div>

          {/* Tiêu đề lớn: TỐI ƯU TỪNG MÉT KHỐI. */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white uppercase leading-[1.08] drop-shadow-md">
            TỐI ƯU <span className="text-cyan-400">TỪNG</span> MÉT KHỐI.
          </h1>

          {/* Dòng mô tả */}
          <p className="mt-4 sm:mt-6 text-base sm:text-lg md:text-xl text-slate-200/95 leading-relaxed font-normal max-w-xl drop-shadow">
            Tối ưu hóa xếp container hàng lẻ LCL bằng thuật toán hình học 3D.
          </p>

          {/* Nút chính bo tròn: Bắt đầu tối ưu → */}
          <div className="mt-8 sm:mt-10">
            <Link
              href={startCtaUrl}
              className="inline-flex items-center gap-3 px-8 sm:px-9 py-4 rounded-full text-base sm:text-lg font-bold bg-primary hover:bg-primary-hover text-white shadow-xl shadow-primary/30 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 group border border-primary-tint/30"
            >
              <span>Bắt đầu tối ưu</span>
              <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </main>

      {/* 4. Đáy trái: 4 khối icon + chữ, cách nhau bằng vạch dọc mảnh */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12 pt-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-0 lg:divide-x lg:divide-white/20 border-t border-white/10 lg:border-t-0 pt-6 lg:pt-0">
          {/* Khối 1 */}
          <div className="flex items-center gap-3 lg:pr-6">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center text-cyan-400 shrink-0">
              <Maximize2 className="w-5 h-5" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-slate-200 leading-snug">
              Tận dụng tối đa không gian container
            </span>
          </div>

          {/* Khối 2 */}
          <div className="flex items-center gap-3 lg:px-6">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center text-cyan-400 shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-slate-200 leading-snug">
              Cân bằng tải trọng và độ ổn định
            </span>
          </div>

          {/* Khối 3 */}
          <div className="flex items-center gap-3 lg:px-6">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center text-cyan-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-slate-200 leading-snug">
              Đảm bảo tương thích hàng hóa
            </span>
          </div>

          {/* Khối 4 */}
          <div className="flex items-center gap-3 lg:pl-6">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center text-cyan-400 shrink-0">
              <TrendingDown className="w-5 h-5" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-slate-200 leading-snug">
              Giảm chi phí và khí thải
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
