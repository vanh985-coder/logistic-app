# DANH SÁCH TÀI KHOẢN VÀ DỮ LIỆU DEMO NỀN TẢNG LOGIX-3D

Tài liệu này cung cấp đầy đủ thông tin tài khoản đăng nhập và dữ liệu mẫu độc lập dành cho ban thẩm định và người dùng thử nghiệm hệ thống **LOGIX-3D Logistics Platform**.

---

## 1. THÔNG TIN ĐĂNG NHẬP CHUNG

- **Địa chỉ truy cập Web:** [http://localhost:3000/login](http://localhost:3000/login)
- **Mật khẩu dùng chung cho TẤT CẢ tài khoản:** `LogixDemo2026!`
- **Cơ chế phân quyền:** Hệ thống tự động cách ly dữ liệu giữa các doanh nghiệp (Multi-tenant Data Isolation). Mỗi người thử nghiệm đăng nhập bằng tài khoản riêng sẽ làm việc trên dữ liệu độc lập của doanh nghiệp mình, không lo bị trùng lặp hay ghi đè.

---

## 2. BẢNG TỔNG HỢP 25 TÀI KHOẢN DEMO

| STT | Email Đăng Nhập | Mật Khẩu | Vai Trò Hệ Thống | Người Đại Diện / Chức Danh | Doanh Nghiệp / Đơn Vị | Ngành Nghề & Tuyến | Số Lô Hàng Sẵn Có |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **1** | `admin01@logix.vn` | `LogixDemo2026!` | `PLATFORM_ADMIN` | Nguyễn Văn An (Platform Admin Cấp Cao) | **Tập đoàn Công nghệ Nền tảng Logix Platform** | Quản trị Nền tảng *(Toàn quốc)* | **—** |
| **2** | `admin02@logix.vn` | `LogixDemo2026!` | `PLATFORM_ADMIN` | Lê Thị Bình (Platform Admin Vận Hành) | **Tập đoàn Công nghệ Nền tảng Logix Platform** | Quản trị Nền tảng *(Toàn quốc)* | **—** |
| **3** | `fwd01@logix.vn` | `LogixDemo2026!` | `FWD_ADMIN` | Trần Đình Trọng (Điều Phối Viên FWD) | **Công ty Cổ phần Vận tải & Tiếp vận Toàn Cầu (Global Trans FWD)** | Giao nhận Tiếp vận (Forwarder) *(Đa tuyến)* | **—** |
| **4** | `fwd02@logix.vn` | `LogixDemo2026!` | `FWD_ADMIN` | Hoàng Minh Đức (Trưởng Phòng Điều Phối FWD) | **Công ty TNHH Giao nhận Vận tải Á Châu (Asia Logistics FWD)** | Giao nhận Tiếp vận (Forwarder) *(Đa tuyến)* | **—** |
| **5** | `fwd03@logix.vn` | `LogixDemo2026!` | `FWD_ADMIN` | Vũ Thanh Tùng (Giám Đốc Khai Thác FWD) | **Công ty CP Tiếp vận Quốc tế Đại Dương (Ocean Express FWD)** | Giao nhận Tiếp vận (Forwarder) *(Đa tuyến)* | **—** |
| **6** | `fwd04@logix.vn` | `LogixDemo2026!` | `FWD_ADMIN` | Nguyễn Mai Phương (Quản Lý Vận Hành FWD) | **Công ty TNHH Vận tải Liên Minh Phương Đông (Orient Freight FWD)** | Giao nhận Tiếp vận (Forwarder) *(Đa tuyến)* | **—** |
| **7** | `fwd05@logix.vn` | `LogixDemo2026!` | `FWD_ADMIN` | Bùi Anh Tuấn (Điều Phối Viên Tổng Hợp FWD) | **Công ty CP Logistics Hàng hải Bắc Nam (North-South Marine FWD)** | Giao nhận Tiếp vận (Forwarder) *(Đa tuyến)* | **—** |
| **8** | `cfs01@logix.vn` | `LogixDemo2026!` | `CFS_ADMIN` | Đỗ Văn Quang (Quản Lý Kho CFS Tân Vũ) | **Công ty TNHH Kho vận CFS Cảng Hải Phòng (Hải Phòng CFS Terminal)** | Kho vận CFS *(Kho CFS Tân Vũ)* | **—** |
| **9** | `cfs02@logix.vn` | `LogixDemo2026!` | `CFS_ADMIN` | Trịnh Hoài Nam (Trưởng Trạm CFS Cát Lái) | **Công ty CP Dịch vụ Kho bãi CFS Cát Lái (Cát Lái Logistics CFS)** | Kho vận CFS *(Kho CFS Cảng Cát Lái)* | **—** |
| **10** | `cfs03@logix.vn` | `LogixDemo2026!` | `CFS_ADMIN` | Phan Thị Hương (Giám Đốc Kho CFS Tiên Sa) | **Công ty TNHH Tiếp vận Kho CFS Cảng Đà Nẵng (Đà Nẵng Port CFS Hub)** | Kho vận CFS *(Kho CFS Tiên Sa)* | **—** |
| **11** | `shipper01@logix.vn` | `LogixDemo2026!` | `SHIPPER_ADMIN` | Lê Minh Hưng (Giám Đốc Xuất Nhập Khẩu) | **Công ty CP Dệt May Hòa Phát** | Dệt may & Thời trang may sẵn *(SGN-HPH)* | **5 lô** |
| **12** | `shipper02@logix.vn` | `LogixDemo2026!` | `SHIPPER_ADMIN` | Trần Thị Mai (Trưởng Phòng Logistics) | **Công ty TNHH Điện Tử Tân Cường** | Linh kiện & Thiết bị vi điện tử *(SGN-HPH)* | **4 lô** |
| **13** | `shipper03@logix.vn` | `LogixDemo2026!` | `SHIPPER_ADMIN` | Phạm Đức Long (Quản Lý Chuỗi Cung Ứng) | **Công ty CP Nội Thất Cát Tường** | Nội thất gỗ xuất khẩu & Thủ công mỹ nghệ *(SGN-HPH)* | **4 lô** |
| **14** | `shipper04@logix.vn` | `LogixDemo2026!` | `SHIPPER_ADMIN` | Hoàng Dũng Tiến (Giám Đốc Vận Hành) | **Công ty TNHH Cơ Khí Chế Tạo Dũng Tiến** | Cơ khí chính xác & Phụ tùng máy công nghiệp *(SGN-HPH)* | **4 lô** |
| **15** | `shipper05@logix.vn` | `LogixDemo2026!` | `SHIPPER_ADMIN` | Ngô Đình Khang (Phó Giám Đốc Kinh Doanh) | **Công ty CP Nông Sản Xuất Khẩu Việt Hương** | Nông sản sấy, Cà phê & Hạt điều chế biến *(SGN-HPH)* | **4 lô** |
| **16** | `shipper06@logix.vn` | `LogixDemo2026!` | `SHIPPER_ADMIN` | Đặng Thùy Dương (Trưởng Bộ Phận Giao Nhận) | **Công ty TNHH Thủy Hải Sản Biển Đông** | Thủy hải sản chế biến & Thực phẩm đóng hộp *(SGN-HPH)* | **4 lô** |
| **17** | `shipper07@logix.vn` | `LogixDemo2026!` | `SHIPPER_ADMIN` | Lâm Vĩnh Hảo (Trưởng Phòng Xuất Nhập Khẩu) | **Công ty CP Sản Xuất Nhựa Rạng Đông Á** | Hạt nhựa kỹ thuật & Bao bì màng ghép *(SGN-DAD)* | **4 lô** |
| **18** | `shipper08@logix.vn` | `LogixDemo2026!` | `SHIPPER_ADMIN` | Trương Hoài Linh (Quản Lý Phân Phối) | **Công ty TNHH Giấy & Bao Bì Tân Phát** | Thùng carton sóng & Bao bì giấy công nghiệp *(SGN-DAD)* | **4 lô** |
| **19** | `shipper09@logix.vn` | `LogixDemo2026!` | `SHIPPER_ADMIN` | Võ Thanh Tuyền (Trưởng Phòng Điều Vận) | **Công ty CP Hóa Mỹ Phẩm Sài Gòn Hoa** | Chất tẩy rửa sinh học & Hóa mỹ phẩm gia dụng *(SGN-DAD)* | **4 lô** |
| **20** | `shipper10@logix.vn` | `LogixDemo2026!` | `SHIPPER_ADMIN` | Nguyễn Tuấn Kiệt (Phụ Trách Kho Vận) | **Công ty TNHH Thực Phẩm Chế Biến Ánh Dương** | Bánh kẹo truyền thống & Nước giải khát *(SGN-DAD)* | **4 lô** |
| **21** | `shipper11@logix.vn` | `LogixDemo2026!` | `SHIPPER_ADMIN` | Bạch Hoàng Yến (Giám Đốc Thương Mại) | **Công ty CP Gốm Sứ Mỹ Nghệ Sài Gòn Xưa** | Gốm sứ tráng men & Đồ trang trí nội thất *(SGN-DAD)* | **4 lô** |
| **22** | `shipper12@logix.vn` | `LogixDemo2026!` | `SHIPPER_ADMIN` | Tống Gia Huy (Trưởng Phòng Kế Hoạch) | **Công ty TNHH Da Giày Xuất Khẩu Thịnh Vượng** | Giày dép da & Túi xách thời trang xuất khẩu *(HAN-SGN)* | **4 lô** |
| **23** | `shipper13@logix.vn` | `LogixDemo2026!` | `SHIPPER_ADMIN` | Quách Bảo Ngọc (Quản Lý Chuỗi Cung Ứng) | **Công ty CP Dệt Kỹ Thuật Nam Phong** | Sợi công nghiệp & Vải địa kỹ thuật *(HAN-SGN)* | **4 lô** |
| **24** | `shipper14@logix.vn` | `LogixDemo2026!` | `SHIPPER_ADMIN` | Triệu Quốc Đạt (Trưởng Phòng Xuất Nhập Khẩu) | **Công ty TNHH Thiết Bị Gia Dụng SunHome** | Thiết bị gia dụng nhà bếp & Đèn LED chiếu sáng *(HAN-SGN)* | **4 lô** |
| **25** | `shipper15@logix.vn` | `LogixDemo2026!` | `SHIPPER_ADMIN` | Hà Bích Diệp (Giám Đốc Logistics) | **Công ty CP Dược & Thiết Bị Y Tế Đại Thành** | Thiết bị y tế tiêu hao & Dược phẩm đóng gói *(HAN-SGN)* | **4 lô** |

---

## 3. DANH SÁCH 3 KẾ HOẠCH GOM HÀNG 3D CONTAINER (DEMO)

Các nhóm ghép container này đã được gom sẵn từ các lô hàng trạng thái `GROUPED` của **4 đến 6 chủ hàng khác nhau**. Khi mở màn hình 3D, các kiện hàng sẽ được phân biệt bằng **các màu sắc chủ hàng khác nhau** tương ứng trong bảng màu 12 chủ hàng chuẩn (*docs/design-spec.md*):

| Tuyến Đường | Mã Nhóm Ghép Cont | Trạng Thái | Số Chủ Hàng Gom Chung | Thể Tích / Tỷ Lệ Lấp Đầy | Tải Trọng / Tỷ Lệ | Đường Dẫn Xem Khung 3D |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **SGN-HPH** | `MG-DEMO-40HC-01` | **CONFIRMED** | **6 chủ hàng** | 60.98 m³ (79.9%) | 10.680 kg (40.3%) | [/match-groups/a0f0e11b-aec0-43f9-b080-2adf2430aee5](http://localhost:3000/match-groups/a0f0e11b-aec0-43f9-b080-2adf2430aee5) |
| **SGN-DAD** | `MG-DEMO-40HC-02` | **CONFIRMED** | **5 chủ hàng** | 50.81 m³ (66.5%) | 8.900 kg (33.6%) | [/match-groups/20b6ffd3-c6a5-4528-89e6-9468c664e38e](http://localhost:3000/match-groups/20b6ffd3-c6a5-4528-89e6-9468c664e38e) |
| **HAN-SGN** | `MG-DEMO-40HC-03` | **PROPOSED** | **5 chủ hàng** | 50.81 m³ (66.5%) | 8.900 kg (33.6%) | [/match-groups/417fa5fc-7684-4ec0-b5f9-fda8b3b0a22a](http://localhost:3000/match-groups/417fa5fc-7684-4ec0-b5f9-fda8b3b0a22a) |

---

## 4. HƯỚNG DẪN TRẢI NGHIỆM CHI TIẾT THEO VAI TRÒ

### A. Dành cho Chủ Hàng (Shipper — `shipper01@logix.vn` đến `shipper15@logix.vn`)
1. Đăng nhập với tài khoản shipper bất kỳ (VD: `shipper01@logix.vn`).
2. Xem **Bảng điều khiển** (`/dashboard/shipper`): Thống kê tổng số lô hàng, thể tích CBM, cước phí.
3. Vào **Quản lý Lô hàng** (`/shipments`): Lọc qua 4 tab trạng thái:
   - **Bản nháp (DRAFT):** Lô hàng mới tạo chưa đủ kiện.
   - **Đã tính cước (PRICED):** Lô hàng đã nhập đầy đủ kích thước, khối lượng và tự động tính cước realtime.
   - **Chờ ghép (SUBMITTED):** Lô hàng đã gửi lên sàn, đang chờ FWD điều phối vào cont.
   - **Đã vào nhóm (GROUPED):** Lô hàng đã được xếp vào nhóm ghép container 40HC.
4. Bấm **"Tạo lô hàng mới"** (`/shipments/new`):
   - Bước 1: Chọn tuyến đường (`SGN-HPH`, `SGN-DAD`, `HAN-SGN`).
   - Bước 2: Nhập kiện hàng (hỗ trợ nhập tay hoặc tải file mẫu Excel). Kiểm tra tính năng chặn kiện kích thước 0.
   - Bước 3: Xem báo giá tức thời theo công thức chuẩn $P_{total} = \max(V \cdot P_v, W \cdot P_w) \cdot H_g + P_{fixed}$.
   - Bước 4: Hoàn tất tạo vận đơn.

### B. Dành cho Công ty Giao Nhận (Forwarder — `fwd01@logix.vn` đến `fwd05@logix.vn`)
1. Đăng nhập với tài khoản FWD (VD: `fwd01@logix.vn`).
2. Vào **Ghép Hàng & Consol** (`/match-groups`): Xem danh sách 3 nhóm ghép container 40HC trên 3 tuyến đường.
3. Bấm vào chi tiết nhóm ghép (VD: `MG-DEMO-40HC-01`):
   - Xem đồng hồ đo lấp đầy thể tích (Volume Gauge) và tải trọng (Weight Gauge).
   - Xem **Khung nhìn mô phỏng 3D Container (Three.js)**: Các khối hàng hiển thị nhiều màu sắc đại diện cho các chủ hàng khác nhau.
   - Thử các chế độ nhìn: Isometric, Top-view (chiếu bằng), Side-view (hông), Front-view (cửa cont).
   - Bấm vào kiện hàng bất kỳ trên không gian 3D để xem thẻ chi tiết kiện (kích thước, chủ hàng, tọa độ $x, y, z$, thứ tự dỡ hàng LIFO).
   - Xem đồ thị trọng tâm CoG an toàn $45\%\text{--}55\%$.

### C. Dành cho Quản Trị Kho Hàng (CFS Operator — `cfs01@logix.vn` đến `cfs03@logix.vn`)
1. Đăng nhập với tài khoản CFS (`cfs01@logix.vn` - Kho CFS Tân Vũ Hải Phòng; `cfs02@logix.vn` - Kho CFS Cát Lái TP.HCM; `cfs03@logix.vn` - Kho CFS Tiên Sa Đà Nẵng).
2. Vào bảng điều khiển kho CFS (`/dashboard/cfs`): Theo dõi tiến độ gom hàng và kế hoạch xuất nhập kho container.

### D. Dành cho Quản Trị Hệ Thống (Platform Admin — `admin01@logix.vn` hoặc `admin02@logix.vn`)
1. Đăng nhập với tài khoản Platform Admin (`admin01@logix.vn`).
2. Vào **Quản trị Doanh nghiệp** (`/dashboard/admin`):
   - Danh sách toàn bộ 25 doanh nghiệp trên sàn.
   - Thao tác phê duyệt hoặc tạm ngưng trạng thái doanh nghiệp (`VERIFIED` / `SUSPENDED`).
   - Giám sát luồng vận hành toàn hệ thống.

---
*Tài liệu tự động tạo bởi script seed dữ liệu của LOGIX-3D Engine.*
