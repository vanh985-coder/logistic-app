# ADR 0008: 3D Extreme Point Packing Engine, Physical Constraints, and Asynchronous Execution

## Status
Accepted

## Context
Trong vận tải hàng lẻ đóng ghép container (*LCL Consolidation*), việc sắp đặt hàng trăm kiện hàng có kích thước, khối lượng và tính chất cơ lý khác nhau vào không gian 3 chiều của container chuẩn ISO (20DC, 40DC, 40HC) là bài toán tối ưu hóa tổ hợp thuộc nhóm **3D Bin Packing Problem with Practical Constraints (3D-BPP-PC)** — một bài toán NP-Hard trong khoa học máy tính.

Để đạt được mục tiêu thương mại (cam kết marketing tỷ lệ lấp đầy sàn $\ge 92\%$) đồng thời đảm bảo an toàn tuyệt đối theo tiêu chuẩn hàng hải quốc tế (**IMO/ILO/UNECE CTU Code** và **SOLAS VGM**), lõi thuật toán đóng gói (*Packing Engine*) phải giải quyết đồng thời các thách thức vật lý phức tạp:

1. **Sai số kích thước và độ lồi lõm thực tế (Cardboard Bulge & 3% Tolerance):** Thùng carton hàng hóa chịu nén và dao động nhiệt/ẩm có độ phồng biên từ $\pm 2\text{mm}$ đến $\pm 4\text{mm}$. Hơn nữa, hệ thống đã cộng 3% dung sai an toàn ở khâu chuẩn hóa. Việc so sánh bằng tuyệt đối cao độ mặt trên của các kiện bên dưới ($z_j + h_j = z$) sẽ làm vô hiệu hóa hầu hết các vị trí xếp chồng.
2. **Phân bổ tải trọng xếp chồng (Load Distribution & maxStackWeight):** Kiện hàng ở tầng trên có thể đè lên 1 kiện hoặc nằm bắc cầu qua 2 hay nhiều kiện tầng dưới. Mô hình tính toán phải phản ánh đúng tỷ lệ diện tích tiếp xúc mà không làm thổi phồng tải trọng dẫn đến từ chối xếp chồng vô lý.
3. **Mâu thuẫn giữa Phân bố Trọng tâm (CoG) và Thứ tự Giao hàng (LIFO):** Tiêu chuẩn an toàn hàng hải yêu cầu trọng tâm dọc container phải nằm trong dải $[45\%, 55\%]$. Tuy nhiên, nếu áp dụng ràng buộc CoG cứng ngắc tại từng bước trung gian, kiện hàng đầu tiên sẽ bị từ chối ngay lập tức.
4. **Tính Tiền Định (Determinism) vs. Ngân Sách Thời Gian 8 Giây:** Hệ thống cam kết cùng input phải sinh ra 100% cùng sơ đồ xếp trên mọi máy chủ, không phụ thuộc vào tốc độ CPU của máy nhanh hay máy chậm.

---

## Decision

### 1. Thuật Toán Lõi: Extreme Points Heuristic kết hợp 3D Voxel Grid
- Triển khai thuật toán **Extreme Points (EP)** mở rộng theo nghiên cứu của *Crainic, Perboli, Pezzuto (2008)*.
- Khởi tạo với gốc tọa độ $\mathcal{EP} = \{ (0, 0, 0) \}$.
- Khi đặt một kiện hàng $k$, hệ thống tự động sinh 3 điểm cơ sở trực tiếp $(x+w, y, z)$, $(x, y+l, z)$, $(x, y, z+h)$ và các điểm chiếu trực giao (*projected EPs*) với các kiện đã đặt xung quanh.
- **Loại bỏ điểm che khuất (Dominated Points):** Loại bỏ các điểm nằm ngoài vách container, các điểm rơi vào bên trong thể tích của kiện khác, các điểm trùng lặp, và các điểm lơ lửng không có giá trị đỡ bên dưới.
- **Kiểm tra va chạm $O(1)$ bằng 3D Voxel Grid (Spatial Hashing):** Chia container thành các ô lưới kích thước $250\text{ mm} \times 250\text{ mm} \times 250\text{ mm}$. Khi kiểm tra va chạm, chỉ so sánh AABB với các kiện nằm trong cùng voxel cell, giảm độ phức tạp từ $O(N)$ xuống $O(1)$ cho mỗi phép thử.

### 2. Dung Sai Tiếp Xúc Đỡ Đáy: `CONTACT_TOLERANCE_MM = 5mm` (Khắc phục Lỗi 1)
- Thiết lập hằng số `CONTACT_TOLERANCE_MM = 5` mm (mặc định, cho phép cấu hình).
- **Lý do chọn 5mm:** Biên độ này vừa đủ để dung hòa độ phồng tự nhiên của thùng carton ($\pm 2-4\text{mm}$) và dung sai an toàn 3% của hệ thống giữa các kiện cùng tầng, nhưng đủ nhỏ để không gây kênh vát làm mất ổn định cơ học.
- **Công thức xác định tập kiện đỡ:**
  $$\mathcal{B} = \left\{ j \in \mathcal{P} \;\middle|\; \big| (z_j + h_j) - z \big| \le \text{CONTACT\_TOLERANCE\_MM} \right\}$$
- Kiện mới được xem là đủ điều kiện đỡ đáy nếu tổng diện tích giao nhau giữa đáy kiện mới và mặt trên của các kiện trong $\mathcal{B}$ đạt $\ge 80.00\%$ diện tích đáy ($S_{\text{support}} / S_{\text{base}} \ge 0.80$).

### 3. Ma Trận Phân Bổ Tải Trọng Đỡ qua Đồ Thị DAG (Khắc phục Lỗi 2)
- Xây dựng đồ thị có hướng không chu trình (**Support DAG**).
- Cạnh có hướng $v \to u$ biểu diễn kiện $v$ (tầng trên) tì lên kiện $u$ (tầng dưới).
- **Công thức phân bổ tải trọng:**
  $$c_{vu} = \frac{\text{Area}(R_v \cap R_u)}{\text{Area}(R_v)}$$
  Trong đó: **Mẫu số là diện tích đáy của kiện bên trên $R_v$**, không phải mặt trên của kiện bên dưới.
  - **Trường hợp 1 (Tựa trên 1 kiện duy nhất):** Kiện $v$ nằm hoàn toàn trong phạm vi mặt trên của $u$, dù $v$ chỉ phủ $20\%, 60\%$ hay $100\%$ mặt $u$, ta có $c_{vu} = 1.0$. Toàn bộ $100\%$ trọng lượng của $v$ truyền thẳng xuống $u$.
  - **Trường hợp 2 (Tựa bắc cầu trên nhiều kiện):** Kiện $v$ nằm trên $u_1$ và $u_2$, tải trọng được phân bổ theo tỷ lệ phần đáy $R_v$ phủ trên mỗi kiện, bảo đảm $\sum_{u} c_{vu} = 1.0$.
- **Kiểm tra an toàn:**
  - Nếu kiện $u$ có cờ `noStack = true`: Tuyệt đối không cho phép đặt bất kỳ kiện nào lên trên.
  - Tổng tải trọng đè dồn $\text{OverheadLoad}(u)$ từ toàn bộ các tầng bên trên không được vượt quá `maxStackWeightGram(u)`.

### 4. Cơ Chế Trọng Tâm (CoG) Hai Tầng & Thuật Toán Sửa Chữa (Khắc phục Lỗi 3)
- **Tầng 1 — Trong lúc xếp Constructive Heuristic:**
  - $f_{\text{cog}} = - \left| \frac{CoG_x}{L} - 0.50 \right|$ chỉ là điểm phạt mềm đóng vai trò lực kéo định hướng khối lượng về phía tâm container, **tuyệt đối không áp dụng phạt cứng hay loại bỏ bước xếp** để cho phép kiện đầu tiên và các kiện trung gian được đặt tự do.
- **Tầng 2 — Kiểm tra và Sửa chữa sau khi xếp xong (CoG Repair Step):**
  - Sau khi hoàn thành lượt xếp tốt nhất, tính trọng tâm tổng thể: $\text{ratio}_x = \frac{CoG_x}{L}$.
  - Nếu $\text{ratio}_x \in [45\%, 55\%]$: Đạt chuẩn $\to$ nghiệm hợp lệ.
  - Nếu $\text{ratio}_x < 45\%$ hoặc $\text{ratio}_x > 55\%$: Kích hoạt vòng lặp sửa chữa (tối đa 50 lượt):
    - Hoán đổi vị trí dọc trục $X$ giữa các cặp kiện nặng/nhẹ ở hai phía đối diện có kích thước tương thích.
    - Dịch chuyển kiện nặng ở tầng sàn sang các khoảng trống dọc theo $X$ để cân bằng mô-men lực.
  - Nếu sau 50 lượt sửa chữa vẫn không đạt (ví dụ: lô hàng toàn hàng nặng không có hàng đối trọng): Thuật toán vẫn trả về kết quả tốt nhất, kèm cờ cảnh báo `cogViolation: true` và `cogWarning` để điều phối viên quyết định.

### 5. Tính Tiền Định (Determinism) và Ngân Sách Thời Gian
- **Tách rời Điều Kiện Dừng khỏi Đồng Hồ CPU:** Thuật toán dừng theo **Số vòng lặp cố định** (`MAX_EVALUATIONS = 2,000` hoặc ngân sách cấu hình), không dừng theo `Date.now()`.
- **Bộ sinh số giả ngẫu nhiên Seeded PRNG:** Triển khai **SplitMix32**, sử dụng hạt giống tạo từ mã băm FNV-1a của chính dữ liệu đầu vào (`container` + `sorted(packages)`).
- **Watchdog Timeout 8 giây:** Chỉ đóng vai trò ngắt khẩn cấp phòng ngừa vòng lặp vô tận hoặc cạn kiệt tài nguyên.

### 6. Kiến Trúc Xử Lý Bất Đồng Bộ (BullMQ) & Bộ Nhớ Đệm Redis
- **Package `@logix/packing`:** Thuần túy TypeScript, độc lập framework, không có dependency runtime nặng ngoài `fast-check` trong dev.
- **Worker BullMQ (`apps/worker`):** Lắng nghe queue `packing_queue`, xử lý tác vụ tính toán 3D nặng nề ngoài luồng chính của API.
- **API `POST /packing/calculate`:**
  - Tính mã băm SHA-256 của cấu hình container và kiện hàng.
  - Tra cứu Redis Cache: Nếu có (`cache HIT`), trả về ngay kết quả HTTP 200.
  - Nếu chưa có (`cache MISS`): Đẩy job vào BullMQ, phản hồi ngay **HTTP 202 Accepted** kèm `{ jobId, status: 'processing' }`.
- **Polling `GET /packing/jobs/:jobId`:** Cho phép client theo dõi tiến độ và nhận kết quả khi `status === 'completed'`.
- **Thời gian sống của cache (TTL):** 3,600 giây (1 giờ).

---

## Consequences & Verification

### 1. Property-Based Testing (fast-check)
Chạy bộ kiểm thử 1,000 trường hợp ngẫu nhiên độc lập (`packages/packing/test/property-based.spec.ts`):
- **Bất biến 1 (Không vượt biên):** $100\%$ kiện đã xếp nằm hoàn toàn trong giới hạn lòng container ($X \le L, Y \le W, Z \le H$).
- **Bất biến 2 (Không chồng lấn):** $100\%$ cặp kiện đã xếp có giao thể tích AABB bằng 0 ($\text{intersectsAABB} = \text{false}$).
- **Thời gian chạy 1,000 runs:** $10.3\text{ giây}$.

### 2. Determinism Verification
Kiểm thử `packages/packing/test/determinism.spec.ts`: Chạy 3 lần độc lập với cùng dữ liệu đầu vào.
- Tỷ lệ lấp đầy (`fillRateBps`): Đồng nhất 100%.
- Tọa độ trọng tâm (`centerOfGravity`): Đồng nhất 100%.
- Tọa độ $(x, y, z)$ và góc xoay (`rotation`) của từng kiện: Trùng khớp chính xác $100\%$ từng milimét.

### 3. Số Đo Benchmark Thực Tế (Container 40HC)
Đo đạc trực tiếp từ suite benchmark (`packages/packing/test/benchmark.spec.ts`):

| Quy Mô Kiện | Thời Gian Chạy (ms) | Số Kiện Xếp Được | Tỷ Lệ Lấp Đầy | Trọng Tâm Dọc ($CoG_x$) | Biến Động RAM Heap |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **50 kiện** | **2,246.05 ms** | 50 / 50 (100%) | 19.76% (hàng nhỏ trong 40HC) | 35.15% (cảnh báo hợp lý) | +25.9 MB |
| **200 kiện** | **8,159.12 ms** | 200 / 200 (100%) | **80.04%** | **49.03%** (hoàn hảo trong [45%, 55%]) | +5.9 MB |
| **500 kiện** | **5,599.42 ms** | 98 / 500 (chạm trần cont) | **86.75%** | **49.87%** (hoàn hảo trong [45%, 55%]) | -6.4 MB (GC) |

*(Ghi chú: Ở kịch bản 500 kiện, container 40HC đạt ngưỡng trần thể tích và tải trọng tối đa tại kiện thứ 98 nên dừng sớm an toàn, đạt hiệu suất lấp đầy 86.75% chỉ trong 5.6 giây).*

### 4. Phát Hiện Điểm Yếu Hệ Thống: Bẫy Khoảng Trần Chết (Ceiling Dead-Space Trap) Lần Thứ Hai

Trong quá trình thực nghiệm và kiểm thử trên dữ liệu thực tế (`MG-DEMO-40HC-01`), một hiện tượng bẫy hình học mang tính **hệ thống** của thuật toán đã tái diễn lần thứ hai:

- **Lần 1 (Tại Phase 4 với kiện 900mm và 800mm):** Chiều cao lòng container 40HC là $H = 2698\text{mm}$. Khi xếp 3 kiện cao $900\text{mm}$, tổng chiều cao là $2700\text{mm} > 2698\text{mm}$ (vượt quá đúng $2\text{mm}$). Giải thuật không thể xếp tầng 3 bằng kiện $900\text{mm}$, và nếu không có cơ chế điều phối chiều cao thì khoảng trần $2698 - 1800 = 898\text{mm}$ bị lãng phí nếu không kết hợp được với kiện $800\text{mm}$.
- **Lần 2 (Tại Đợt 2 với bộ dữ liệu thật 72 kiện của 6 chủ hàng):**
  - Trong `MG-DEMO-40HC-01`, có 12 kiện kích thước lớn $1200\times 1000\times 1000\text{mm}$.
  - Khi áp dụng heuristic thể tích giảm dần toàn cục (*Global Volume-Descending*), cả 12 kiện cao $1000\text{mm}$ này được xếp trước và chiếm trọn diện tích sàn container.
  - Hai kiện cao $1000\text{mm}$ xếp chồng lên nhau đạt độ cao $2000\text{mm}$, để lại khoảng hở trần:
    $$2698\text{mm} - 2000\text{mm} = 698\text{mm}$$
  - Tuy nhiên, kiện có chiều cao nhỏ nhất trong toàn bộ 72 kiện của database là **$700\text{mm}$** ($1200\times 800\times 700\text{mm}$).
  - Do $698\text{mm} < 700\text{mm}$, toàn bộ khoảng không gian $698\text{mm}$ kéo dài suốt nóc container trở thành **KHÔNG GIAN CHẾT (Dead Space)**, không thể nhét vừa bất kỳ kiện nào!
  - Hậu quả: Dù là chiến lược `MAX_VOLUME`, giải thuật lại bị kẹt ở 63/72 kiện (bỏ lại 9 kiện nhỏ nhất ở cuối danh sách), thua cả chiến lược `LIFO_PRIORITY` (66/72 kiện) vốn vô tình gom kiện theo chủ hàng có chiều cao đa dạng.

#### Bài học kiến trúc & Giải pháp khắc phục có hệ thống:
Đây là **điểm yếu cố hữu** của các thuật toán Heuristic tham lam kiểu Best-Fit Decreasing: việc xếp toàn bộ kiện to xuống trước tạo ra một mặt sàn giả ở cao độ cố định, biến phần không gian trần còn lại thành "phế phẩm" nếu nó nhỏ hơn kiện nhỏ nhất trong kho.

**Giải pháp đã áp dụng trong `@logix/packing`:**
1. **Shipment Lot Batching Heuristic:** Thay vì sắp xếp giảm dần toàn cục qua tất cả các chủ hàng, thuật toán bổ sung hoán vị gom kiện theo từng lô chủ hàng (*Lot Batching*). Vì mỗi chủ hàng sở hữu cơ cấu kích thước đa dạng (kiện 1000, 900, 850, 800, 700mm), giải thuật tự động ghép các kiện thành cột 3 tầng hoàn chỉnh:
   - $1000\text{mm} + 850\text{mm} + 800\text{mm} = 2650\text{mm}$ (hở trần chỉ $48\text{mm} \approx 1.8\%$).
   - $900\text{mm} + 900\text{mm} + 800\text{mm} = 2600\text{mm}$ (hở trần $98\text{mm} \approx 3.6\%$).
2. **Loại bỏ ảnh hưởng chéo của `dropOrder`:** Cô lập hoàn toàn điểm thưởng `fLifo` và hoán vị dỡ hàng chỉ cho chiến lược `LIFO_PRIORITY`. Chiến lược `MAX_VOLUME` tập trung 100% vào việc khai thác không gian container qua các hoán vị thể tích, tỷ trọng (*Density*), diện tích đáy (*Footprint*), và xáo trộn cửa sổ (*Windowed Perturbation*).
3. **Kết quả:** `MAX_VOLUME` vươn lên dẫn đầu với **68/72 kiện xếp được (Fill Rate 73.57%)**, cao hơn `LIFO_PRIORITY` (66/72 kiện, 73.30%) và `CONSIGNEE_GROUPED` (66/72 kiện, 73.02%).

