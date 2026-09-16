'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../lib/api-client';
import { Activity, Database, Server, RefreshCw, Layers, ShieldCheck, Box } from 'lucide-react';

interface HealthData {
  status: string;
  uptime: number;
  timestamp: string;
  totalLatencyMs: number;
  services: {
    database: {
      status: 'up' | 'down';
      latencyMs?: number;
    };
    redis: {
      status: 'up' | 'down';
      latencyMs?: number;
    };
  };
}

export default function WalkingSkeletonPage() {
  const { data, error, isLoading, isFetching, refetch } = useQuery<HealthData>({
    queryKey: ['system-health'],
    queryFn: () => fetchApi<HealthData>('/health/ready'),
    refetchInterval: 5000,
    staleTime: 0,
    retry: 2,
    retryDelay: 1000,
  });

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-6xl mx-auto flex flex-col justify-between">
      <div>
        {/* Top Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between pb-8 border-b border-border gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                3D
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  LOGIX-3D <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">Phase 0: Walking Skeleton</span>
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Nền tảng SaaS gom hàng lẻ LCL/LTL với lõi tối ưu xếp container 3D
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-secondary text-foreground hover:bg-muted border border-border transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Làm mới trạng thái
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${
                data?.status === 'ok'
                  ? 'bg-status-completed animate-pulse'
                  : data?.status === 'degraded'
                  ? 'bg-status-pending'
                  : isLoading
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-status-failed'
              }`} />
              <span className="text-muted-foreground">Hệ thống:</span>
              <span className="font-semibold uppercase">
                {data?.status === 'ok'
                  ? 'HOẠT ĐỘNG (UP)'
                  : data?.status === 'degraded'
                  ? 'SUY GIẢM (DEGRADED)'
                  : isLoading
                  ? 'ĐANG KẾT NỐI...'
                  : 'LỖI (DOWN)'}
              </span>
            </div>
          </div>
        </header>

        {/* Connectivity Status Cards */}
        <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: NestJS API */}
          <div className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">REST API Gateway</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                    data
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : isLoading
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {data ? '● UP' : isLoading ? '● CONNECTING' : '● DOWN'}
                  </span>
                  <Server className="w-4 h-4 text-blue-400" />
                </div>
              </div>
              <h2 className="text-xl font-bold mt-2 font-mono">NestJS 11</h2>
              <p className="text-xs text-muted-foreground mt-1">Cổng dịch vụ backend và định tuyến dữ liệu</p>
            </div>
            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Uptime máy chủ:</span>
              <span className="font-mono font-semibold text-foreground">
                {data?.uptime !== undefined ? `${data.uptime}s` : '---'}
              </span>
            </div>
          </div>

          {/* Card 2: PostgreSQL Database */}
          <div className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cơ sở dữ liệu</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                    data?.services?.database?.status === 'up'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : isLoading
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {data?.services?.database?.status === 'up' ? '● UP' : isLoading ? '● CONNECTING' : '● DOWN'}
                  </span>
                  <Database className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
              <h2 className="text-xl font-bold mt-2 font-mono">PostgreSQL 16</h2>
              <p className="text-xs text-muted-foreground mt-1">Prisma ORM + Migration 0_init (Company, User)</p>
            </div>
            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Độ trễ truy vấn:</span>
              <span className="font-mono font-semibold text-foreground">
                {data?.services?.database?.latencyMs !== undefined ? `${data.services.database.latencyMs}ms` : '---'}
              </span>
            </div>
          </div>

          {/* Card 3: Redis Cache & BullMQ */}
          <div className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bộ nhớ đệm & Hàng đợi</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                    data?.services?.redis?.status === 'up'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : isLoading
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {data?.services?.redis?.status === 'up' ? '● UP' : isLoading ? '● CONNECTING' : '● DOWN'}
                  </span>
                  <Activity className="w-4 h-4 text-amber-400" />
                </div>
              </div>
              <h2 className="text-xl font-bold mt-2 font-mono">Redis 7 + BullMQ</h2>
              <p className="text-xs text-muted-foreground mt-1">Quản lý phiên, cache và hàng đợi job tính toán 3D</p>
            </div>
            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Ping Redis:</span>
              <span className="font-mono font-semibold text-foreground">
                {data?.services?.redis?.latencyMs !== undefined ? `${data.services.redis.latencyMs}ms` : '---'}
              </span>
            </div>
          </div>
        </section>

        {/* Phase 0 Architecture Checklist */}
        <section className="mt-8 p-6 rounded-xl bg-card border border-border">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Kiểm tra các tiêu chuẩn kỹ thuật Phase 0
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border/50">
              <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-foreground">Monorepo Workspace</span>
                <p className="text-muted-foreground mt-0.5">pnpm + Turborepo quản lý 3 apps (web, api, worker) và 2 packages (shared, packing).</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border/50">
              <Layers className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-foreground">Prisma Migration 0_init</span>
                <p className="text-muted-foreground mt-0.5">Bảng Company + User + enums role/status theo đúng điều chỉnh số 2. Sơ đồ 13 bảng lưu tại docs/erd.md.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border/50">
              <Box className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-foreground">Quy chuẩn đơn vị & Trục 3D</span>
                <p className="text-muted-foreground mt-0.5">Kích thước milimet integer, map Three.js (x3d=X, y3d=Z, z3d=Y), bổ sung sealNumber và containerCode.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border/50">
              <Activity className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-foreground">Chiến lược Polling Job (ADR-0002)</span>
                <p className="text-muted-foreground mt-0.5">Polling GET /packing-jobs/:id (interval 1s, backoff 2s) stateless, sẵn sàng scale ngang không cần Redis Pub/Sub.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Live Payload inspector */}
        {data && (
          <section className="mt-6 p-4 rounded-xl bg-slate-950 border border-border/50 text-xs font-mono">
            <div className="flex items-center justify-between text-muted-foreground pb-2 mb-2 border-b border-slate-800">
              <span>GET /health/ready Payload phản hồi thực tế:</span>
              <span>{data.timestamp}</span>
            </div>
            <pre className="text-emerald-400 overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>
          </section>
        )}

        {error && (
          <div className="mt-6 p-4 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-300">
            <strong>Lỗi kết nối API:</strong> {(error as Error).message}. Vui lòng kiểm tra API server và biến NEXT_PUBLIC_API_URL.
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between text-xs text-muted-foreground gap-2">
        <span>LOGIX-3D SaaS © 2026. Production-grade Architecture.</span>
        <span>Next.js 15 App Router • TanStack Query v5 • Tailwind CSS</span>
      </footer>
    </main>
  );
}
