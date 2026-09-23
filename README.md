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

## Kiểm Thử Tự Động & Cách Ly Dữ Liệu Test (E2E)

Hệ thống thiết lập cơ chế cách ly tuyệt đối giữa dữ liệu demo/phát triển và dữ liệu kiểm thử E2E:
- **Database phát triển & Demo:** `logix3d_db` (được cấu hình qua `DATABASE_URL`). Chứa 25 tài khoản doanh nghiệp demo và dữ liệu ghép mẫu.
- **Database kiểm thử E2E:** `logix3d_test` (được cấu hình qua `DATABASE_URL_TEST`). Hoạt động trên cùng Docker Postgres container.

### 1. Chạy E2E Test Tự Động
Chạy lệnh sau tại thư mục gốc:
```bash
pnpm test:e2e
```
**Quy trình tự động hóa tích hợp:**
1. Script `apps/api/scripts/prepare-test-db.ts` tự động kết nối Postgres, kiểm tra và tạo database `logix3d_test` nếu chưa tồn tại.
2. Tự động áp dụng toàn bộ Prisma migrations (`npx prisma migrate deploy`) lên `logix3d_test`.
3. Jest nạp `apps/api/test/setup-e2e.ts`, đảm bảo mọi thao tác API/Prisma trong quá trình test chỉ kết nối tới `DATABASE_URL_TEST`.
4. Ngay cả khi bị dừng đột ngột (`Ctrl+C`), dữ liệu demo trên `logix3d_db` hoàn toàn không bị ảnh hưởng hay phát sinh rác test.

### 2. Dọn Dẹp Dữ Liệu Rác Dự Phòng
Nếu trước đây từng phát sinh dữ liệu test trên database demo:
```bash
pnpm db:clean-test
```
Script sẽ tự động quét và dọn sạch các bản ghi rác có tiền tố test (`MG-TEST-...`, `SHP-TEST-...`, `TAX-TEST-...`).

---

## Hướng Dẫn Chạy Demo Từ Xa Qua Ngrok

Khi cần chia sẻ hệ thống cho đối tác hoặc người dùng trải nghiệm từ xa mà không cần triển khai cloud, bạn có thể chọn một trong hai phương án sau:

### Phương án 1: Dùng 1 Tunnel ngrok duy nhất qua Next.js Proxy (Khuyên Dùng — Phù hợp Ngrok Free)
Tài khoản Ngrok Free chỉ cho phép mở tối đa 1 tunnel. Next.js đã được cấu hình proxy rewrites (`/api/backend/:path*` -> `http://localhost:3001/:path*`).
**Lợi ích vượt trội:** Web và API chạy chung 1 domain nên **không cần CORS, không cần cấu hình `SameSite=None`**, cookie refresh token hoạt động hoàn toàn tự nhiên theo chuẩn gốc `SameSite=Strict`.

1. **Cập nhật file `.env` (hoặc `apps/web/.env.local`):**
   ```env
   # Kích hoạt Next.js Proxy mode (API client dùng đường dẫn tương đối /api/backend)
   NEXT_PUBLIC_USE_PROXY=true
   API_INTERNAL_URL=http://localhost:3001
   ```

2. **Chỉ cần mở 1 tunnel cho Web Frontend (port 3000):**
   ```bash
   ngrok http 3000
   # => Nhận URL tunnel: https://xxxx-xxxx.ngrok-free.dev (hoặc .app)
   ```

3. **Khởi động lại Next.js Dev Server** (`Ctrl+C` và `pnpm dev`) để nạp biến môi trường mới.

---

### Phương án 2: Khởi tạo 2 Tunnel ngrok độc lập (Web 3000 + API 3001)
Dành cho trường hợp tài khoản Ngrok trả phí hoặc muốn tách biệt hoàn toàn 2 domain:

1. **Mở 2 terminal chạy 2 tunnel:**
   ```bash
   # Terminal 1 — Tunnel Web Frontend:
   ngrok http 3000   # => https://xxxx-xxxx.ngrok-free.app (WEB_TUNNEL_URL)

   # Terminal 2 — Tunnel Backend API:
   ngrok http 3001   # => https://yyyy-yyyy.ngrok-free.app (API_TUNNEL_URL)
   ```

2. **Cập nhật `.env`:**
   - Web Frontend: `NEXT_PUBLIC_API_URL=https://yyyy-yyyy.ngrok-free.app` (trỏ sang domain API)
   - Backend API: `TUNNEL_MODE=true` (bật cookie cross-site `SameSite=None; Secure`)

3. **Cơ chế tự động hỗ trợ khi chạy 2 tunnel:**
   - **CORS Regex ngrok:** Backend API ở môi trường dev (`NODE_ENV !== 'production'`) đã tích hợp sẵn regex tự động chấp nhận mọi subdomain của ngrok (`*.ngrok-free.app`, `*.ngrok-free.dev`, `*.ngrok.app`, `*.ngrok.dev`, `*.ngrok.io`).
   - **Duy trì đăng nhập (Auto Token Refresh):** Khi bật `TUNNEL_MODE=true`, cookie `refreshToken` được đính kèm `SameSite=None; Secure`, cho phép trình duyệt gửi kèm cookie trong các request cross-site HTTPS.

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
