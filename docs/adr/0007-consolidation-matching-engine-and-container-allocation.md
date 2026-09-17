# ADR 0007: Consolidation Matching Engine and Container Allocation Strategy

## Context
Trong vận tải biển quốc tế và nội địa, hàng lẻ LCL (*Less than Container Load*) từ nhiều chủ hàng độc lập (*Shippers*) cần được gom thành các lô hàng nguyên container (*FCL - Full Container Load*) trên cùng tuyến hành trình (*Lane*). Việc ghép hàng đặt ra những thách thức kỹ thuật cốt lõi:

1. **Ràng Buộc Vật Lý Kép (Volume & Weight Boundaries):** Vỏ container chuẩn ISO có giới hạn thể tích lòng cont ($V_{\text{cont}}$) và giới hạn tải trọng hàng hóa tối đa ($W_{\text{payload}}$). Hàng nặng làm chạm trần tải trọng trước khi đầy thể tích (vận tải theo trọng lượng), trong khi hàng cồng kềnh làm chạm trần thể tích trước khi đầy tải trọng (vận tải theo thể tích).
2. **Hệ Số Rỗng Vật Lý Trong Thực Tế (Packing Factor Void Ratio):** Khi đóng ghép các thùng carton có kích thước không đồng nhất hoặc hàng có cờ `noStack`/`isFragile`, tỷ lệ lấp đầy thể tích lý thuyết không thể đạt 100% (ngưỡng an toàn thực tế tối đa là $\approx 92.00\% = 9200\text{ bps}$).
3. **Mâu Thuẫn Kiến Trúc Đa Thuê Bao (Multi-Tenancy vs. Cross-Tenant Aggregation):** Lô hàng `Shipment` thuộc sở hữu của một doanh nghiệp Shipper cụ thể (`companyId`). Tuy nhiên, một nhóm gom `MatchGroup` lại tập hợp hàng hóa từ nhiều Shipper khác nhau vào cùng một vỏ container do Forwarder điều phối. Nếu `MatchGroup` bị áp bộ lọc tự động `where: { companyId }` của extension Prisma đa thuê bao, hệ thống sẽ không thể hiển thị nhóm gom cho nhiều Shipper và Forwarder cùng khai thác.
4. **Độ Chính Xác Số Học Tuyệt Đối (Zero-Float Guarantee):** Toàn bộ số liệu dung tích ($mm^3$), trọng lượng (gram) và tỷ lệ lấp đầy (basis points $10000 = 100.00\%$) phải dùng số nguyên `BigInt` và `Int`, loại bỏ triệt để sai số dấu phẩy động IEEE-754.

---

## Decision

### 1. Phân Loại Mô Hình Dữ Liệu Đa Thuê Bao (Multi-Tenant Model Classification)
- `ContainerType`, `MatchGroup`, và `MatchGroupShipment` được phân loại rõ ràng trong `GLOBAL_MODELS` tại `tenant-models.config.ts`.
- **Cơ chế Bảo mật Phân quyền Cấp Ứng dụng (Application-Level Authorization):**
  - **Forwarder & Platform Admin:** Có toàn quyền truy vấn, lập kế hoạch, kích hoạt thuật toán đề xuất (`POST /match-groups/propose`), chốt ghép (`POST /match-groups/:id/confirm`) hoặc hủy (`POST /match-groups/:id/cancel`).
  - **Shipper:** Khi truy vấn danh sách `GET /match-groups`, bộ lọc nghiệp vụ cưỡng chế chỉ trả về các nhóm có chứa ít nhất một lô hàng của Shipper đó (`matchGroupShipments.some.shipment.companyId === user.companyId`). Khi truy vấn trực tiếp `GET /match-groups/:id`, nếu Shipper không có lô hàng trong nhóm sẽ bị trả về ngay mã lỗi **HTTP 403 Forbidden**.

### 2. Thuật Toán Lựa Chọn Container & Ghép Hàng Greedy Best-Fit Decreasing (BFD)
Hệ thống triển khai thuật toán ghép hàng tối ưu hóa tại `MatchingEngine`:
1. **Kiểm tra tương thích kích thước từng kiện (Dimensional Feasibility):** Từng kiện hàng trong lô phải có kích thước ba chiều sau khi xoay hợp lệ nhỏ hơn hoặc bằng kích thước cửa và lòng cont ($L \le L_{\text{cont}}, W \le W_{\text{cont}}, H \le H_{\text{cont}}$).
2. **Lựa chọn vỏ cont phù hợp (Best Container Selection):**
   - Nếu có kiện hàng cao vượt kích thước 20DC/40DC ($> 2,393\text{ mm}$): Bắt buộc đề xuất `40HC` (High Cube container, chiều cao lòng $2,698\text{ mm}$).
   - Nếu tổng thể tích ứng viên $\le 30.5\text{ CBM}$ và tổng khối lượng $\le 28.2\text{ tấn}$: Ưu tiên đề xuất vỏ `20DC`.
   - Nếu tổng thể tích trong khoảng $30.5\text{ CBM} - 62.3\text{ CBM}$ và khối lượng $\le 26.7\text{ tấn}$: Ưu tiên đề xuất vỏ `40DC`.
   - Vượt ngưỡng trên: Đề xuất `40HC`.
3. **Gom hàng theo Greedy Knapsack:**
   - Sắp xếp các lô hàng ứng viên trạng thái `SUBMITTED` theo thể tích giảm dần.
   - Thêm từng lô hàng vào container nếu và chỉ nếu:
     $$\sum V_i \le \left\lfloor \frac{V_{\text{cont}} \times 9200}{10000} \right\rfloor \quad \text{và} \quad \sum W_i \le W_{\text{payload}}$$
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
- **Tối ưu hóa Chi phí Vận tải:** Forwarder nhanh chóng đạt tỷ lệ lấp đầy mong muốn ($> 80\%$) mà không phải tính toán thủ công từng kiện hàng.
- **Không Rò Rỉ Dữ Liệu:** Shipper chỉ nhìn thấy kế hoạch đóng cont có hàng của mình, không xem được danh sách đơn hàng của các shipper đối thủ trong các container khác.
- **Tính Toán Toàn Vẹn Tuyệt Đối:** Không có sai số làm tròn khi hiển thị tỷ lệ lấp đầy hoặc tính toán quá tải trục (axle overload).
- **Fail-Fast Bootstrap:** Mọi mô hình dữ liệu mới đều được kiểm tra phân loại tự động tại thời điểm khởi động server (`validateAllModelsClassified`).

### Nhược điểm / Hạn chế (Negative & Trade-offs)
- Thuật toán ở Phase 3 tập trung vào tối ưu dung tích và tải trọng tổng thể (1D/volumetric knapsack with dimensional bounding). Việc xếp chi tiết tọa độ 3D từng kiện $(x, y, z)$, kiểm tra trọng tâm (Center of Gravity) và phân lớp bốc dỡ (LIFO drop order) sẽ do Lõi thuật toán Extreme Point xử lý trong Phase 4.
