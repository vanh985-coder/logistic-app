# LOGIX-3D — Nền Tảng Ghép Hàng LCL & Tối Ưu Container 3D

LOGIX-3D là nền tảng SaaS gom hàng lẻ (LCL/LTL) dành cho ngành logistics với lõi tối ưu hóa xếp container 3D đa ràng buộc vật lý, kết nối 4 nhóm người dùng: **Shipper** (chủ hàng), **FWD** (forwarder), **CFS** (kho gom hàng), và **Admin** (quản trị hệ thống).

---

## Khởi Chạy Local Từ Zero (Đúng 3 Lệnh)

Chạy 3 lệnh sau theo thứ tự tại thư mục gốc:

```bash
# 1. Khởi tạo cấu hình môi trường
cp .env.example .env

# 2. Khởi động toàn bộ hạ tầng (Postgres 16, Redis 7, MinIO S3)
docker compose -f infra/docker-compose.yml up -d

# 3. Cài đặt dependencies và khởi động toàn bộ ứng dụng
pnpm install && pnpm run dev
```

Sau khi chạy:
- **Web Frontend:** [http://localhost:3000](http://localhost:3000)
- **REST API:** [http://localhost:3001](http://localhost:3001)
- **Health Check API:** [http://localhost:3001/health/ready](http://localhost:3001/health/ready)
- **MinIO Console:** [http://localhost:9001](http://localhost:9001) (`logix_minio_admin` / `logix_minio_secret_key`)

---

## Cấu Trúc Monorepo

```
.
├── apps/
│   ├── web/           # Next.js 15 App Router, React Three Fiber, TanStack Query, Tailwind CSS
│   ├── api/           # NestJS REST API, Prisma ORM, Pino Logger, Helmet
│   └── worker/        # BullMQ Background Worker xử lý packing CPU-bound
├── packages/
│   ├── shared/        # Constants, enums, TypeScript interfaces, Zod schemas
│   └── packing/       # Thuật toán xếp container 3D Extreme Point (pure TypeScript)
├── docs/
│   ├── erd.md         # Sơ đồ thực thể 13 bảng toàn hệ thống
│   └── adr/           # Quyết định kiến trúc kỹ thuật (ADR-0001, ADR-0002)
└── infra/
    ├── docker-compose.yml       # Hạ tầng dev (Postgres, Redis, MinIO)
    └── docker-compose.prod.yml  # Hạ tầng prod (+ PgBouncer connection pooler)
```

---

## Kiến Trúc & Quyết Định Kỹ Thuật (ADRs)

- [ADR 0001: Monorepo & Skeleton Architecture](docs/adr/0001-monorepo-and-skeleton-architecture.md)
- [ADR 0002: Packing Job Polling vs. Server-Sent Events](docs/adr/0002-job-status-polling-strategy.md)
- [ADR 0003: 3D InstancedMesh & Interaction](docs/adr/0003-3d-instancedmesh-and-interaction.md)
- [ADR 0004: Tenant Resolution & Invalidation Strategy](docs/adr/0004-tenant-resolution-and-invalidation-strategy.md)
- [ADR 0005: Pricing Engine, Geometric Surcharge Factor (Hg), and Versioning](docs/adr/0005-pricing-geometric-surcharge-and-versioning.md)
- [ADR 0006: In-Memory Access Token Storage and HttpOnly Refresh Cookie Architecture](docs/adr/0006-in-memory-access-token-security.md)
- [ADR 0007: Consolidation Matching Engine and Container Allocation Strategy](docs/adr/0007-consolidation-matching-engine-and-container-allocation.md)
- [Sơ đồ dữ liệu 13 thực thể (ERD)](docs/erd.md)

---

## Lộ Trình Triển Khai

- [x] **Phase 0:** Walking skeleton (Monorepo, docker-compose, Prisma 0_init, CI, Next.js calls NestJS)
- [x] **Phase 1:** Xác thực & Doanh nghiệp (Argon2id, JWT rotation, RBAC guard, Onboarding)
- [x] **Phase 2:** Lô hàng & Tính cước (CRUD Shipment/Package, công thức cước Hg, import Excel)
- [x] **Phase 3:** Matching (Ghép lô hàng cùng tuyến, gợi ý phương án)
- [ ] **Phase 4:** Lõi thuật toán xếp hàng 3D & Worker BullMQ
- [ ] **Phase 5:** Màn hình 3D React Three Fiber (InstancedMesh, thanh trượt layer, CoG)
- [ ] **Phase 6:** Forwarder, CFS, Tracking & Nghiệm thu
- [ ] **Phase 7:** Production Hardening (PgBouncer, Rate limit, Prometheus, K6 load test)
