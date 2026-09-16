# ADR 0004: Tenant Resolution and Invalidation Strategy

## Context
Hệ thống **LOGIX-3D** là nền tảng SaaS B2B Multi-tenant phục vụ nhiều bên tham gia (Shipper, Forwarder, CFS Warehouse, Platform Admin).
Mỗi request từ client tới backend API cần được phân giải ngữ cảnh tenant (`companyId`, `role`, `companyStatus`, `userStatus`) nhằm đảm bảo:
1. Tính cách ly dữ liệu tuyệt đối (Zero Data Leakage giữa các tenant).
2. Hiệu năng cao cho các request định kỳ mà không gây thắt cổ chai tại cơ sở dữ liệu PostgreSQL.
3. Khả năng vô hiệu hóa quyền tức thì khi tài khoản hoặc công ty bị khóa/đình chỉ (`SUSPENDED`/`INACTIVE`), ngăn chặn rủi ro JWT còn hạn 15 phút nhưng user đã bị thu hồi quyền.

## Decision
Áp dụng **Phương án C: Hybrid JWT + Redis Tenant Status Cache** kết hợp **Prisma Client Extension ($allOperations)**:

1. **Cấu trúc JWT Access Token:**
   - Access token có thời hạn ngắn (15 phút), chứa payload tối thiểu: `sub` (userId), `companyId`, `role`, `type: 'access'`.
2. **Tenant Context Resolution qua NestJS Guard / Interceptor:**
   - Khi request tới, `JwtAuthGuard` giải mã JWT và lấy `userId`, `companyId`.
   - Tra cứu trạng thái trong Redis với key `user:tenant:<userId>` (TTL: 15 phút):
     - Cache data: `{ companyId, companyStatus, userStatus, role }`.
     - **Cache hit:** Nếu `companyStatus !== 'ACTIVE'` hoặc `userStatus !== 'ACTIVE'`, từ chối ngay lập tức với HTTP 403 Forbidden.
     - **Cache miss:** Truy vấn PostgreSQL để lấy thông tin mới nhất, lưu vào Redis với TTL 15m.
   - Thiết lập `TenantContextService` dựa trên Node.js `AsyncLocalStorage` để lan truyền context xuống mọi tầng service và repository mà không cần truyền thủ công qua từng tham số hàm.
3. **Cơ chế Invalidation Tức thì (Immediate Invalidation):**
   - Bất cứ khi nào trạng thái công ty hoặc người dùng thay đổi (ví dụ: `PATCH /companies/:id/status`, khóa user, đổi role), xóa ngay key `user:tenant:<userId>` trong Redis (hoặc xóa toàn bộ user thuộc company khi company bị đình chỉ).
   - Request tiếp theo buộc phải đọc lại từ PostgreSQL và nhận trạng thái mới nhất ngay lập tức.
4. **Tenant Isolation tại tầng Database (Prisma Extension):**
   - Mọi truy vấn trên các entity nghiệp vụ thuộc tenant (`TENANT_MODELS`) tự động được chèn điều kiện `where: { companyId: context.companyId }`.
   - Các hàm `findUnique` và `findUniqueOrThrow` được tự động chuyển đổi thành `findFirst` và `findFirstOrThrow` kèm `companyId` để ngăn ngừa lỗ hổng IDOR.
   - Ngoại lệ: Chỉ role `PLATFORM_ADMIN` hoặc các luồng hệ thống được định danh rõ ràng qua client riêng biệt (`prisma.unsafeGlobal`) mới được phép bỏ qua bộ lọc tenant.
   - **Fail-fast Validation:** Lúc API bootstrap, Prisma DMMF được quét để kiểm tra mọi model. Nếu có bất kỳ model nào chưa được phân loại vào `TENANT_MODELS`, `TENANT_SELF_MODELS`, hoặc `GLOBAL_MODELS`, ứng dụng sẽ throw exception và dừng khởi động ngay lập tức.
   - **Zero-context Safety:** Nếu request gọi đến `TENANT_MODELS` mà không có tenant context (chưa đăng nhập hoặc context rỗng), Prisma extension ném ngay `TenantContextMissingException`, tuyệt đối không chèn `companyId: undefined`.

## Consequences
- **Ưu điểm:**
  - Tách biệt hoàn toàn dữ liệu giữa các công ty ở tầng thấp nhất (ORM), loại trừ lỗi lập trình viên quên filter ở từng service.
  - Phản ứng tức thì (< 1ms) khi vô hiệu hóa quyền hạn mà không cần chờ JWT 15 phút hết hạn.
  - Giảm tải tới 95% truy vấn database kiểm tra user/company status trên mỗi request.
- **Đánh đổi & Biện pháp:**
  - Phụ thuộc vào Redis: Nếu Redis gặp sự cố, hệ thống có thể fallback truy vấn trực tiếp DB và ghi log cảnh báo.
  - Cần cẩn trọng khi thực hiện các truy vấn cross-tenant của `PLATFORM_ADMIN` và background worker; phải sử dụng đúng interface `unsafeGlobal`.
