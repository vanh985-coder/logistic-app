# ADR 0007: Consolidation Matching Engine, Multi-Tenant Isolation, and Container Allocation Strategy

## Status
Accepted (Amended to include `TENANT_RELATION_MODELS` and clarify 1D preliminary ceiling vs Phase 4 3D KPI floor)

## Context
Trong vận tải biển quốc tế và nội địa, hàng lẻ LCL (*Less than Container Load*) từ nhiều chủ hàng độc lập (*Shippers*) cần được gom thành các lô hàng nguyên container (*FCL - Full Container Load*) trên cùng tuyến hành trình (*Lane*). Việc ghép hàng đặt ra những thách thức kỹ thuật cốt lõi:

1. **Ràng Buộc Vật Lý Kép (Volume & Weight Boundaries):** Vỏ container chuẩn ISO có giới hạn thể tích lòng cont ($V_{\text{cont}}$) và giới hạn tải trọng hàng hóa tối đa ($W_{\text{payload}}$). Hàng nặng làm chạm trần tải trọng trước khi đầy thể tích (vận tải theo trọng lượng), trong khi hàng cồng kềnh làm chạm trần thể tích trước khi đầy tải trọng (vận tải theo thể tích).
2. **Ngưỡng Trần Sơ Bộ 1D (Phase 3) vs. Cam Kết KPI Tối Thiểu 3D (Phase 4):**
   - **Giai đoạn sơ bộ 1D (Phase 3):** Thuật toán ghép hàng chạy trên quy mô tổng thể tích ($mm^3$) và khối lượng ($g$). Nhằm tối ưu hóa hiệu quả kinh tế và dành biên độ dung sai vật lý cho bước xếp dỡ 3D sau này, thuật toán áp dụng ngưỡng trần sơ bộ `MAX_PRELIMINARY_FILL_BPS = 9500` (95.00%).
   - **Cam kết Marketing & KPI 3D Packing (Phase 4):** Ngưỡng $\ge 92\%$ là **cam kết sàn (minimum KPI floor)** mà lõi thuật toán đóng gói không gian 3D (Extreme Point Packing Engine) phải đạt được khi xếp tọa độ cụ thể $(x, y, z)$. Đặt trần 92% ở khâu sơ bộ 1D là đảo ngược bản chất nghiệp vụ; do đó Phase 3 dùng trần dung sai 95% để cho phép gom tối đa hàng hóa trước khi giải bài toán không gian 3 chiều.
3. **Mâu Thuẫn Kiến Trúc Đa Thuê Bao (Multi-Tenancy vs. Cross-Tenant Aggregation):** Lô hàng `Shipment` thuộc sở hữu của một doanh nghiệp Shipper cụ thể (`companyId`). Tuy nhiên, một nhóm gom `MatchGroup` lại tập hợp hàng hóa từ nhiều Shipper khác nhau vào cùng một vỏ container do Forwarder điều phối. Nếu `MatchGroup` bị đặt vào `GLOBAL_MODELS`, lớp bảo vệ đa thuê bao bị vô hiệu hóa hoàn toàn, phụ thuộc vào việc lập trình viên phải nhớ kiểm tra thủ công tại từng service/controller (nguy cơ rò rỉ dữ liệu thương mại cạnh tranh).
4. **Độ Chính Xác Số Học Tuyệt Đối (Zero-Float Guarantee):** Toàn bộ số liệu dung tích ($mm^3$), trọng lượng (gram) và tỷ lệ lấp đầy (basis points $10000 = 100.00\%$) phải dùng số nguyên `BigInt` và `Int`, loại bỏ triệt để sai số dấu phẩy động IEEE-754.

---

## Decision

### 1. Kiến Trúc Đa Thuê Bao: Cơ Chế `TENANT_RELATION_MODELS` & Defense-in-Depth

Để giải quyết triệt để bài toán bảo mật đa thuê bao cho nhóm ghép hàng, 3 phương án kiến trúc đã được cân nhắc:

- **Phương án A (Global + Manual Join):** Giữ `MatchGroup` trong `GLOBAL_MODELS` và viết code join thủ công qua `MatchGroupShipment` ở từng service.
  - *Đánh giá:* **Bác bỏ**. Vi phạm nguyên tắc bảo mật phòng thủ chiều sâu (defense-in-depth). Chỉ cần một lập trình viên tạo endpoint mới hoặc quên lọc ở tầng service là toàn bộ dữ liệu thương mại của các shipper bị lộ.
- **Phương án C (Admin/FWD Only View):** MatchGroup chỉ FWD và ADMIN thấy được; Shipper chỉ thấy view tổng hợp qua endpoint riêng biệt.
  - *Đánh giá:* **Bác bỏ**. Gây phân mảnh schema API, làm phức tạp frontend và sinh ra nhiều truy vấn trùng lặp.
- **Phương án B (LỰA CHỌN) — `TENANT_RELATION_MODELS` kết hợp `companyId` trên `MatchGroupShipment`:**
  - `MatchGroupShipment` được xếp vào `TENANT_MODELS`. Cột `companyId` được bổ sung trực tiếp vào bảng `match_group_shipments` cùng chỉ mục kép `@@index([companyId, matchGroupId])` và khóa ngoại trỏ tới `Company`.
  - `MatchGroup` được xếp vào danh mục mới: `TENANT_RELATION_MODELS`.
  - **Prisma Extension Interception:**
    - Khi **Shipper** truy vấn `matchGroup`:
      - Thao tác đọc đơn lẻ (`findUnique`, `findUniqueOrThrow`): Tự động viết lại (rewrite) thành `findFirst`/`findFirstOrThrow` kèm điều kiện bắt buộc `{ matchGroupShipments: { some: { companyId } } }`. Nếu Shipper A truy vấn nhóm của Shipper B, kết quả trả về `null` $\to$ ứng dụng phản hồi **HTTP 404 Not Found** (hoặc 403), ngăn chặn hoàn toàn tấn công rà quét mã nhóm (ID enumeration).
      - Thao tác đọc danh sách (`findFirst`, `findMany`, `count`, `aggregate`): Tự động inject filter `matchGroupShipments: { some: { companyId } }`. Shipper chỉ thấy các nhóm có hàng của mình.
      - Thao tác sửa đổi dữ liệu (`create`, `update`, `delete`, `upsert`): Ném ngay `ForbiddenException` vì Shipper không được phép can thiệp trực tiếp cấu trúc nhóm đóng cont.
    - Khi **Consolidation Operators** (`PLATFORM_ADMIN`, `ADMIN`, `FWD_ADMIN`, `FWD_OPERATOR`, `CFS_ADMIN`, `CFS_OPERATOR`): Được cấp quyền bypass tự động trên `MatchGroup` và `MatchGroupShipment` để vận hành, điều phối gom hàng liên công ty.

### 2. Thuật Toán Lựa Chọn Container & Ghép Hàng Greedy Best-Fit Decreasing (BFD)

Hệ thống triển khai thuật toán ghép hàng tối ưu hóa tại `MatchingEngine`:
1. **Kiểm tra tương thích kích thước từng kiện (Dimensional Feasibility):** Từng kiện hàng trong lô phải có kích thước ba chiều sau khi xoay hợp lệ nhỏ hơn hoặc bằng kích thước cửa và lòng cont ($L \le L_{\text{cont}}, W \le W_{\text{cont}}, H \le H_{\text{cont}}$).
2. **Lựa chọn vỏ cont phù hợp (Best Container Selection):**
   - Nếu có kiện hàng cao vượt kích thước 20DC/40DC ($> 2,393\text{ mm}$): Bắt buộc đề xuất `40HC` (High Cube container, chiều cao lòng $2,698\text{ mm}$).
   - Nếu tổng thể tích ứng viên $\le 30.5\text{ CBM}$ và tổng khối lượng $\le 28.2\text{ tấn}$: Ưu tiên đề xuất vỏ `20DC`.
   - Nếu tổng thể tích trong khoảng $30.5\text{ CBM} - 62.3\text{ CBM}$ và khối lượng $\le 26.7\text{ tấn}$: Ưu tiên đề xuất vỏ `40DC`.
   - Vượt ngưỡng trên: Đề xuất `40HC`.
3. **Gom hàng theo Greedy Knapsack với Ngưỡng Trần Sơ Bộ:**
   - Sắp xếp các lô hàng ứng viên trạng thái `SUBMITTED` theo thể tích giảm dần.
   - Hằng số `MAX_PRELIMINARY_FILL_BPS = 9500` (95.00% dung sai thể tích sơ bộ).
   - Thêm từng lô hàng vào container nếu và chỉ nếu:
     $$\sum V_i \le \left\lfloor \frac{V_{\text{cont}} \times 9500}{10000} \right\rfloor \quad \text{và} \quad \sum W_i \le W_{\text{payload}}$$
   - Tính toán tỷ lệ lấp đầy theo đơn vị Basis Points:
     $$\text{volumeFillBps} = \left\lfloor \frac{\sum V_i \times 10000}{V_{\text{cont}}} \right\rfloor, \quad \text{weightFillBps} = \left\lfloor \frac{\sum W_i \times 10000}{W_{\text{payload}}} \right\rfloor$$

### 3. Vòng Đời Trạng Thái Lô Hàng & Nhóm Gom (State Machine Transitions)
Hệ thống bảo đảm tính toàn vẹn trạng thái thông qua Database Transaction:
- **Khởi tạo Đề xuất (`PROPOSED`):**
  - Sinh mã định danh chuẩn nghiệp vụ: `MGyyMMddxxx` (ví dụ `MG260917001`).
  - Lô hàng chuyển từ `SUBMITTED` sang `MATCHING` (không cho phép sửa kiện hay xóa lô trong lúc đang nằm trong kế hoạch).
- **Chốt Ghép Cont (`CONFIRMED`):**
  - Nhóm chuyển trạng thái `CONFIRMED`.
  - Toàn bộ lô hàng thành viên chuyển trạng thái `GROUPED`.
- **Hủy Kế Hoạch (`CANCELLED`):**
  - Nhóm chuyển trạng thái `CANCELLED`.
  - Toàn bộ lô hàng thành viên được giải phóng về lại `SUBMITTED`, sẵn sàng tham gia các đợt quét thuật toán tiếp theo.

---

## Consequences

### Ưu điểm (Positive)
- **Bảo Mật Tự Động Triệt Để:** Bảo vệ đa thuê bao diễn ra tại tầng Prisma Client Extension; lập trình viên không cần nhớ thêm điều kiện `where` thủ công.
- **Rõ Ràng Nghiệp Vụ:** Phân định rõ giữa trần dung sai 1D ($95\%$) ở Phase 3 và sàn cam kết 3D ($\ge 92\%$) ở Phase 4.
- **Hiệu Năng Cao:** Thêm chỉ mục `[companyId, matchGroupId]` trên bảng `match_group_shipments` giúp câu lệnh kiểm tra quyền sở hữu diễn ra tức thì qua Index-Only Scan.
- **Tính Toán Toàn Vẹn Tuyệt Đối:** Không có sai số làm tròn khi hiển thị tỷ lệ lấp đầy hoặc tính toán quá tải trục (axle overload).
- **Fail-Fast Bootstrap:** Mọi mô hình dữ liệu mới đều được kiểm tra phân loại tự động tại thời điểm khởi động server (`validateAllModelsClassified`).

### Nhược điểm / Hạn chế (Negative & Trade-offs)
- Thuật toán ở Phase 3 tập trung vào tối ưu dung tích và tải trọng tổng thể (1D/volumetric knapsack with dimensional bounding). Việc xếp chi tiết tọa độ 3D từng kiện $(x, y, z)$, kiểm tra trọng tâm (Center of Gravity) và phân lớp bốc dỡ (LIFO drop order) sẽ do Lõi thuật toán Extreme Point xử lý trong Phase 4.
