# ADR 0001: Monorepo and Skeleton Architecture for LOGIX-3D

## Context
Hệ thống **LOGIX-3D** là một nền tảng SaaS vận tải LCL/LTL phức hợp, bao gồm frontend web (Next.js 15), backend REST API (NestJS), background worker (BullMQ consumer), và các logic dùng chung (shared schemas, 3D bin packing engine).
Cần một cấu trúc mã nguồn thống nhất, cho phép chia sẻ mã an toàn (type sharing), độc lập triển khai, và tối ưu hóa thời gian build/test trong môi trường local và CI.

## Decision
1. **Quản lý Monorepo:** Sử dụng **pnpm workspaces** kết hợp **Turborepo**.
   - `/apps/web`: Next.js 15 (App Router), Tailwind CSS, TanStack Query, React Three Fiber.
   - `/apps/api`: NestJS REST API, Prisma ORM, Helmet, Pino Logger.
   - `/apps/worker`: BullMQ consumer riêng biệt cho các tác vụ CPU-bound (packing computation).
   - `/packages/shared`: Chứa các types, enums, constants, và zod schemas dùng chung.
   - `/packages/packing`: Lõi thuật toán xếp hàng 3D thuần TypeScript, zero runtime framework dependency.
2. **Cơ sở dữ liệu & Di chuyển (Migration):**
   - Sử dụng PostgreSQL 16 và Prisma ORM.
   - Nguyên tắc: Mọi thay đổi schema phải thông qua migration file. Trong Phase 0, chỉ khởi tạo 2 bảng cốt lõi là `Company` và `User` (`0_init`). Các thực thể khác được phân bổ theo từng phase nghiệp vụ tương ứng.
3. **Cấu hình Hạ tầng Local:**
   - Docker Compose quản lý PostgreSQL, Redis (Alpine), và MinIO (S3-compatible).

## Consequences
- **Ưu điểm:**
  - Strict type sharing giữa client và server thông qua `packages/shared`.
  - Giảm thiểu tối đa overhead trùng lặp dependencies nhờ cơ chế symlink/hardlink của pnpm.
  - Phân tách ranh giới rõ ràng giữa tác vụ I/O-bound (NestJS API) và CPU-bound (Worker).
- **Nhược điểm & Biện pháp giảm thiểu:**
  - Đòi hỏi quy chuẩn cấu hình tsconfig references và Dockerfile multi-stage đúng ngữ cảnh monorepo.
