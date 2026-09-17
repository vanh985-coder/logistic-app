# ADR 0005: Pricing Engine, Geometric Surcharge Factor (Hg), and Effective-Dating Versioning

## Context
Trong hệ thống logistics B2B **LOGIX-3D**, chi phí vận chuyển phụ thuộc vào hai yếu tố kích thước cơ bản (thể tích quy đổi $V$ và khối lượng thực tế $W$) cùng các đặc tính hình học xếp dỡ thực tế của từng kiện hàng (khả năng chịu lực, tỉ lệ cạnh, cờ không cho phép xếp chồng).

Những thách thức kỹ thuật cần giải quyết:
1. **Sai số dấu phẩy động (Floating-Point Arithmetic):** Chuẩn IEEE-754 (như kiểu `float`/`double` trong JavaScript/PostgreSQL) gây ra sai số làm tròn tích lũy khi tính toán tài chính (ví dụ `0.1 + 0.2 = 0.30000000000000004`), không thể chấp nhận được trong thanh toán cước và xuất hóa đơn VAT.
2. **Hiểu đúng bản chất phụ phí hình học $H_g$:** Phụ phí $H_g$ là hệ số phụ phí hình học và xếp dỡ vật lý (Geometric & Stacking Surcharge Factor) phản ánh sự lãng phí không gian trong container/xe tải khi kiện hàng không thể xếp chồng hoặc có hình dạng bất thường, tuyệt đối không phải phụ phí hàng nguy hiểm/hóa chất (Hazardous).
3. **Quản lý phiên bản bảng cước theo thời gian (Effective-Dating Versioning):** Các đơn vị forwarder/vận tải thay đổi biểu cước định kỳ. Đơn hàng lịch sử phải được bảo toàn chính xác giá trị và phiên bản biểu cước tại thời điểm ký kết, đồng thời đơn hàng mới phải áp dụng ngay bảng cước hiện hành mà không được phép có xung đột về tính duy nhất của biểu cước đang hoạt động.
4. **Nguồn chân lý duy nhất cho thể tích (Single Source of Truth):** Việc lưu trữ song song thể tích dưới dạng milimét khối và mét khối (CBM) dẫn đến rủi ro lệch đồng bộ dữ liệu khi kích thước kiện hàng bị chỉnh sửa.

## Decision

### 1. Công thức Tính cước 100% Số nguyên VNĐ (Integer-Only Arithmetic)
Hệ thống áp dụng công thức tính cước chuẩn hóa:
$$P_{total} = \max(V \times P_v, W \times P_w) \times H_g + P_{fixed}$$

Trong đó toàn bộ đại lượng được biểu diễn và tính toán dưới dạng số nguyên `BigInt`:
- **Thể tích quy đổi:** $V \times P_v = \operatorname{roundDiv}(\text{volumeMm3} \times P_v, 10^9)$ với $P_v$ là đơn giá CBM (`cbmRate` VNĐ/m³).
- **Khối lượng quy đổi:** $W \times P_w = \operatorname{roundDiv}(\text{weightGrams} \times P_w, 1000)$ với $P_w$ là đơn giá kg (`weightRateKg` VNĐ/kg).
- **Giá gốc chuẩn:** $\text{winningBaseAmount} = \max(V \times P_v, W \times P_w)$.
  - Nếu $V \times P_v \ge W \times P_w$: `chargeableBasis = 'VOLUME'`.
  - Ngược lại: `chargeableBasis = 'WEIGHT'`.
- **Làm tròn nửa lên (Round-Half-Up):**
  $$\operatorname{roundDiv}(a, b) = \frac{a + \lfloor b / 2 \rfloor}{b} \quad (a, b > 0)$$
- **Phụ phí hình học $H_g$ tính theo Basis Points (`SCALE = 10_000n`):**
  $$\text{surchargedAmount} = \operatorname{roundDiv}(\text{winningBaseAmount} \times H_{g\text{-bps}}, 10000n)$$
- **Tổng cước:**
  $$\text{totalAmount} = \text{surchargedAmount} + P_{fixed}$$

### 2. Định nghĩa và Mức độ Phụ phí Hình học $H_g$
Hệ số $H_g$ được phân thành 3 mức độ rõ ràng:
- **Mức 1 — Tiêu chuẩn ($H_g = 1.00$, `standardSurchargeBps = 10000`):** Kiện hàng hình hộp chữ nhật chuẩn, có thể xếp chồng bình thường trong thùng chứa.
- **Mức 2 — Kiện bất thường / Dễ vỡ ($H_g = 1.15$, `irregularSurchargeBps = 11500`):** Áp dụng khi kiện hàng có cờ `isFragile = true` HOẶC tỉ lệ kích thước cạnh bất thường:
  $$\frac{\max(L, W, H)}{\min(L, W, H)} > \text{maxEdgeRatioThreshold}$$
  (ngưỡng mặc định là 5, được cấu hình linh hoạt trong từng `PricingConfig`).
- **Mức 3 — Không thể xếp chồng ($H_g = 1.30$, `noStackSurchargeBps = 13000`):** Áp dụng khi kiện hàng có cờ `noStack = true`. Kiện này buộc phải đặt trên cùng hoặc đứng một mình, chiếm trọn toàn bộ cột thể tích thẳng đứng trong container.
- **Quy tắc giải quyết xung đột (Precedence):** Trong một lô hàng gồm nhiều kiện, hệ số $H_g$ của toàn bộ lô hàng được lấy theo giá trị lớn nhất ($\max(H_g)$) giữa tất cả các kiện cấu thành.

### 3. Nguồn Chân lý Duy nhất cho Kích thước và Thể tích
- Trường `volumeMm3` kiểu `BigInt` là nguồn chân lý DUY NHẤT lưu trữ thể tích của `Package` và tổng `Shipment`.
- Tuyệt đối không tạo cột `cbm` trong cơ sở dữ liệu. Mọi nhu cầu hiển thị thể tích CBM trên UI hoặc báo cáo đều là giá trị phái sinh được chia cho $10^9$ tại thời điểm render.

### 4. Quản lý Phiên bản Bảng cước theo Thời gian (Effective Dating)
- Loại bỏ hoàn toàn cờ `isCurrent: Boolean`.
- Phiên bản bảng cước đang kích hoạt của một tuyến (`laneId`) được xác định DUY NHẤT bởi điều kiện:
  $$\text{effectiveTo IS NULL}$$
- Toàn vẹn dữ liệu được cưỡng chế ở cấp vật lý của PostgreSQL bằng Partial Unique Index:
  ```sql
  CREATE UNIQUE INDEX "pricing_configs_lane_id_current_idx" 
  ON "pricing_configs" ("laneId") 
  WHERE "effectiveTo" IS NULL;
  ```
- Khi ban hành bảng cước mới:
  1. Cập nhật bảng cước đang kích hoạt: `SET "effectiveTo" = NOW()`
  2. Tạo bản ghi bảng cước mới với `effectiveFrom = NOW()`, `effectiveTo = NULL`, `version = currentVersion + 1`.
  Toàn bộ thao tác thực hiện nguyên tử trong một database transaction.
- Mỗi lô hàng lưu trường `pricingConfigId` và snapshot toàn bộ dữ liệu tính toán (`pricingSnapshot: Json`) tại thời điểm xác nhận giá, đảm bảo tính bất biến và khả năng kiểm toán hồi tố 100%.

## Consequences
- **Ưu điểm:**
  - Loại bỏ hoàn toàn lỗi làm tròn số thực trong kế toán doanh nghiệp B2B.
  - Phản ánh chính xác chi phí vận hành thể tích thực tế thông qua hệ số $H_g$.
  - Database tự bảo vệ tính duy nhất của bảng cước hiện hành qua Partial Index, ngăn ngừa triệt để lỗi race condition khi cập nhật cước.
  - Lưu trữ thể tích nhất quán, loại bỏ nguy cơ lệch số liệu giữa mm³ và m³.
- **Đánh đổi:**
  - Xử lý `BigInt` trong JavaScript yêu cầu hàm serialization phù hợp khi chuyển đổi sang JSON (tránh `TypeError: Do not know how to serialize a BigInt`).

## Giới hạn Hiện tại và Định hướng Chuyển đổi Multi-tenant
- **Phân loại hiện tại:** `PricingConfig` và `Lane` đang được xếp vào `GLOBAL_MODELS` vì ở giai đoạn hiện tại (Phase 2), toàn bộ biểu giá do sàn (`PLATFORM_ADMIN`) quy định tập trung dùng chung cho các Shipper.
- **Ranh giới bảo mật:** Để bảo vệ thông tin thương mại nhạy cảm, API công khai (`GET /lanes`, `GET /lanes/:id`) cho khách hàng chỉ trả về duy nhất phiên bản giá đang có hiệu lực (`currentPricingConfig`). Toàn bộ lịch sử các phiên bản giá cũ được khóa chặt và chỉ mở cho `PLATFORM_ADMIN` qua endpoint riêng biệt `GET /lanes/:id/pricing-history`.
- **Định hướng Phase tiếp theo:** Nếu hệ thống mở rộng cho phép các forwarder (`FWD`) tự do niêm yết biểu giá cạnh tranh riêng cho từng khách hàng hoặc tuyến đường của họ, bảng `PricingConfig` (và có thể cả `Lane`) **BẮT BUỘC PHẢI CHUYỂN SANG `TENANT_MODELS`**, bổ sung cột `companyId` và áp dụng đầy đủ quy tắc lọc dòng tự động để đảm bảo tuyệt đối không rò rỉ giá giữa các forwarder đối thủ.

