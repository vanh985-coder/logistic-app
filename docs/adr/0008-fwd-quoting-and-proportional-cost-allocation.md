# ADR 0008: FWD Quoting Model, Proportional Cost Allocation, and Booking Finalization

## Context
Trong hệ thống logistics gom hàng lẻ (LCL Consolidation) **LOGIX-3D**, một container 40HC sau khi hoàn tất thuật toán xếp hàng sẽ chứa các lô hàng của nhiều chủ hàng (Shipper) khác nhau (thường từ 4 đến 6 chủ hàng).
Forwarder (FWD) là đơn vị thuê bao nguyên container (FCL) từ hãng tàu và cung cấp dịch vụ gom hàng trọn gói.
Hệ thống cần giải quyết 3 bài toán kiến trúc then chốt:
1. **Mô hình Báo giá (Quoting Model):** FWD chào giá như thế nào cho chuyến container gom hàng?
2. **Thuật toán Phân bổ Chi phí (Cost Allocation):** Làm sao chia chi phí container cho từng chủ hàng một cách công bằng, minh bạch, phản ánh đúng đặc thù hình học (hàng dị hình, cấm đè, dễ vỡ) mà không làm thất thoát tiền tệ do làm tròn số?
3. **Quy trình Chốt Booking và Ra Quyết Định (Consensus vs. Coordinator Decision):** Ai là người quyết định chọn báo giá và tạo Booking vận tải?

## Decision

### 1. Mô hình Báo giá Nguyên Container (Per-Container FWD Quote)
FWD gửi một báo giá tổng cho toàn bộ container của nhóm ghép (`MatchGroup`).
Báo giá gồm 5 khoản mục chi phí cấu thành:
- Cước biển chính (`mainFreightVnd`)
- Phí xếp dỡ tại cảng / CFS (`terminalHandlingVnd`)
- Phí phát hành chứng từ vận tải (`documentationVnd`)
- Phụ phí biến động nhiên liệu / BAF (`bunkerFuelVnd`)
- Thuế GTGT (`vatAmountVnd`)
- Thời gian vận chuyển dự kiến (`transitDays`) và thời hạn hiệu lực (`validUntil`).

Tổng chi phí container:
$$Q_{total} = P_{freight} + P_{thc} + P_{doc} + P_{fuel} + P_{vat}$$

### 2. Thuật toán Phân bổ Cước theo Tỷ trọng Cước Chuẩn Phase 2 (Weighted Pro-rata Allocation)
Không áp dụng phương pháp cào bằng thể tích ($V$) thuần túy vì bỏ qua trọng lượng và phụ phí hình học $H_g$ (hàng cấm đè $\times 1.30$, hàng dễ vỡ $\times 1.15$).

Hệ thống sử dụng tỷ trọng cước chuẩn hóa đã tính ở Phase 2 (ADR-0005) của từng lô hàng:
$$C_i = \max(V_i \cdot P_v, W_i \cdot P_w) \cdot H_{g,i} + P_{fixed}$$

Tổng cước chuẩn của cả nhóm:
$$C_{total} = \sum_{k=1}^N C_k$$

Số tiền phân bổ cho chủ hàng $i$ ($i = 1 \dots N-1$):
$$Q_i = \left\lfloor \frac{Q_{total} \times C_i}{C_{total}} \right\rfloor$$

**Bảo toàn Tính Toàn Vẹn Tiền Tệ (Zero Rounding Loss Guarantee):**
Vì $Q_i$ là số nguyên VNĐ (BigInt), phép chia số nguyên luôn để lại phần dư. Chủ hàng cuối cùng ($i = N$) sẽ nhận toàn bộ phần còn lại:
$$Q_N = Q_{total} - \sum_{k=1}^{N-1} Q_k$$

Đảm bảo bất biến:
$$\sum_{i=1}^N Q_i \equiv Q_{total}$$

### 3. Quy trình Quyết định Chốt Booking (Coordinator Decision with Shipper Opt-out)
- **Quyết định cho Demo Phase 6:** FWD là bên chủ động điều phối lịch tàu và chốt giá. Shipper có quyền xem chi tiết cước phân bổ của mình. Khi FWD bấm "Chốt Booking", hệ thống tạo bản ghi `Booking`, chuyển `MatchGroup` sang `CONFIRMED`.
- **Cơ chế Bảo vệ Shipper (Opt-out):** Nếu Shipper không chấp thuận chi phí hoặc thay đổi kế hoạch, Shipper có quyền bấm "Tách khỏi nhóm" trước khi đóng cont. Lô hàng sẽ hoàn trả về trạng thái `SUBMITTED`, hệ thống tự động tái tính toán cước phân bổ cho các chủ hàng còn lại.
- **Hướng phát triển tương lai (Post-Demo):** Cơ chế bỏ phiếu phân tán (Consensus Voting) với ngưỡng chấp thuận $\ge 60\%$ thể tích container kết hợp cửa sổ thời gian 12h sẽ được xem xét triển khai khi quy mô sàn mở rộng.

## Consequences
- **Ưu điểm:**
  - FWD chỉ cần gửi một báo giá tổng cont đơn giản và chính xác.
  - Phân bổ cước tự động, công bằng, bảo toàn 100% từng đồng VNĐ.
  - Quy trình chốt cont diễn ra nhanh gọn, phù hợp cho trải nghiệm demo trực quan.
- **Tuân thủ Multi-tenant:**
  - Model `Quote` và `Booking` được phân loại vào `TENANT_RELATION_MODELS`.
  - FWD chỉ thấy báo giá của chính mình; Shipper chỉ thấy báo giá của các nhóm cont mà mình có hàng.