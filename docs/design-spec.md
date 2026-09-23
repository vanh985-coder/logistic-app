# TÀI LIỆU ĐẶC TẢ THIẾT KẾ GIAO DIỆN HỆ THỐNG LOGIX-3D
## (LOGIX-3D DESIGN SYSTEM SPECIFICATION)
**Phiên bản:** 3.0 — Hoàn tất Đợt 1 (Đã sửa), Đợt 2 và Đợt 3 (Toàn bộ 9 Thư mục Mockup)  
**Trạng thái:** Chờ duyệt (Pending Review)  
**Nguồn chân lý duy nhất (Single Source of Truth) cho toàn bộ UI và Mô phỏng 3D**  
**Cơ sở thiết kế:** Trích xuất pixel chuẩn xác từ bộ Mockup Figma/App (`design/mockups/`)  

---

## MỤC LỤC
0. [Phân định Phạm vi Triển khai (Scope Definition 3 Nhóm)](#0-phân-định-phạm-vi-triển-khai-scope-definition-3-nhóm)
1. [Hệ thống Design Tokens (Toàn cục — Chế độ Sáng Mặc định)](#1-hệ-thống-design-tokens-toàn-cục--chế-độ-sáng-mặc-định)
2. [Hệ màu Semantic cho Trạng thái Nghiệp vụ (Đo Pixel Thực tế)](#2-hệ-màu-semantic-cho-trạng-thái-nghiệp-vụ-đo-pixel-thực-tế)
3. [Bảng màu 12 Chủ hàng trong Không gian 3D & Kiểm định Toán học CIEDE2000](#3-bảng-màu-12-chủ-hàng-trong-không-gian-3d--kiểm-định-toán-học-ciede2000)
4. [Danh mục Component & Ma trận 7 Trạng thái](#4-danh-mục-component--ma-trận-7-trạng-thái)
5. [Phân tích Chi tiết Từng Màn hình (Toàn bộ 9 Thư mục)](#5-phân-tích-chi-tiết-từng-màn-hình-toàn-bộ-9-thư-mục)
   - 5.1. Thư mục 01: Đăng ký tài khoản Chủ hàng (Shipper)
   - 5.2. Thư mục 02: Đăng ký tài khoản Đối tác Vận tải (FWD) & Kho bãi (CFS)
   - 5.3. Thư mục 03: Quy trình Đăng hàng LCL & Chi tiết Đơn hàng
   - 5.4. Thư mục 04: Ghép nối Lô hàng & Mô phỏng Xếp container 3D
   - 5.5. Thư mục 05: Gợi ý Chi phí & Lựa chọn FWD Phù hợp
   - 5.6. Thư mục 06: Thông tin FWD Hiển thị (Bản Công khai vs Bản Sau kết nối)
   - 5.7. Thư mục 07: Bàn giao Hàng hóa tại Kho CFS (Touch-First Mobile/Tablet)
   - 5.8. Thư mục 08: Gom hàng & Đóng Container (CFS Stuffing & Inspection)
   - 5.9. Thư mục 09: Trạng thái Vận chuyển & Đánh giá 3 Bên (End-to-End Tracking)
6. [Ánh xạ Thiết kế từ Mobile Mockup sang Web Desktop & Thiết bị Hiện trường](#6-ánh-xạ-thiết-kế-từ-mobile-mockup-sang-web-desktop--thiết-bị-hiện-trường)
7. [Nghiệp vụ Backend Mới Cần Bổ sung (Bảo vệ Thông tin Liên hệ FWD)](#7-nghiệp-vụ-backend-mới-cần-bổ-sung-bảo-vệ-thông-tin-liên-hệ-fwd)
8. [Đối chiếu Codebase Hiện tại & Kế hoạch Viết lại Giao diện](#8-đối-chiếu-codebase-hiện-tại--kế-hoạch-viết-lại-giao-diện)
9. [Danh sách Vấn đề Cần Làm rõ (Unclear Points & Discrepancies)](#9-danh-sách-vấn-đề-cần-làm-rõ-unclear-points--discrepancies)

---

## 0. PHÂN ĐỊNH PHẠM VI TRIỂN KHAI (SCOPE DEFINITION 3 NHÓM)

Để đảm bảo tiến độ và chất lượng cho phiên bản demo cốt lõi, toàn bộ khối lượng thiết kế từ 9 thư mục mockup được phân loại thành 3 nhóm ưu tiên thực thi:

### 0.1. Nhóm A — Bắt buộc / Luồng Demo Cốt lõi (Mandatory Core Flow)
Tập trung toàn lực hoàn thành trước, kiểm thử thực tế trên trình duyệt:
1. **Đăng nhập & Đăng ký tài khoản:** Phiên bản Web Desktop 1 trang gộp form (Single-page Tabbed / Split View) cho Shipper và FWD/CFS, không chia nhỏ 5-6 bước mobile rời rạc.
2. **Danh sách Lô hàng & Tạo mới Lô hàng LCL:** Bảng dữ liệu chuẩn (Data Table), form tạo lô hàng kèm bản tóm tắt chi phí/thông số dạng thẻ cố định bên cạnh.
3. **Danh sách Nhóm ghép & Chi tiết Nhóm ghép:** Quản lý các lô hàng được gom chung container, trạng thái ghép nối, tiến độ tải trọng và thể tích.
4. **Màn hình Mô phỏng Xếp Container 3D (Thư mục 04):** Trọng tâm giá trị của dự án — hiển thị không gian 3D tương tác Three.js, trực quan hóa vị trí kiện hàng của 12 chủ hàng, danh sách step-by-step quy trình xếp dỡ, thanh trượt thời gian xếp hàng.
5. **Dashboard điều hành theo vai trò (Role-based Dashboards):** Bảng tổng quan số liệu KPI cho Shipper và FWD/Admin.

### 0.2. Nhóm B — Nên có nếu kịp tiến độ (Nice-to-Have Post Core)
Triển khai ngay sau khi Nhóm A nghiệm thu hoàn tất:
1. **Chi tiết hồ sơ FWD (Thư mục 06):** Phân định 2 chế độ hiển thị: *Bản công khai* (ẩn liên hệ nhạy cảm) và *Bản sau kết nối* (hiển thị đầy đủ SĐT, email, biểu phí).
2. **Gợi ý so sánh chi phí FWD (Thư mục 05):** Bảng bóc tách so sánh giá cước giữa các forwarder đề xuất.
3. **Theo dõi trạng thái vận chuyển (Thư mục 09):** Timeline hành trình container từ cảng đi đến cảng đích.

### 0.3. Nhóm C — Tạm hoãn / Sau Demo (Post-Demo Deferred)
Các tính năng đòi hỏi tích hợp phần cứng hiện trường hoặc backend mở rộng chưa có:
1. **Bàn giao tại kho CFS (Thư mục 07):** Quy trình kiểm đếm kiện, biên bản giao nhận CFS, chụp ảnh hư hỏng (Cần camera/thiết bị cầm tay PDA).
2. **Đóng container & Niêm phong chì (Thư mục 08):** Đóng cont thực địa, quét mã seal chì ngoại quan.
3. **Hệ thống đánh giá 3 chiều (3-way Rating):** Đánh giá chéo Shipper - FWD - CFS.
4. **Bản đồ định vị tàu biển GPS (Real-time AIS Vessel Map):** Đòi hỏi tích hợp API vệ tinh bên thứ 3 (MarineTraffic/VesselFinder).

---

## 1. HỆ THỐNG DESIGN TOKENS (TOÀN CỤC — CHẾ ĐỘ SÁNG MẶC ĐỊNH)

### 1.1. Nguyên tắc Nền sáng (Light Mode First) & Ngoại lệ 3D Container
> [!IMPORTANT]
> **CHẾ ĐỘ SÁNG (LIGHT MODE) LÀ CHẾ ĐỘ MẶC ĐỊNH VÀ CHÍNH YẾU:**
> - Toàn bộ mockup từ Đăng ký, Quản lý đơn, Danh sách FWD, So sánh chi phí, Bàn giao CFS đến Tracking hành trình đều là **nền sáng (`#F8FAFC`)**, bề mặt thẻ trắng tinh (`#FFFFFF`), chữ tiêu đề màu **Xanh Navy đậm (`#0A192F` / `#0F2E5C`)**.
> - Mã nguồn frontend cũ đang áp dụng dark mode (`slate-950`) là **sai lệch hoàn toàn** so với bản thiết kế và sẽ được viết lại toàn bộ sang nền sáng.
> - Chế độ tối (Dark mode) chỉ là tùy chọn phụ làm sau.
> - **NGOẠI LỆ CÓ CHỦ ĐÍCH DUY NHẤT:** Khung nhìn 3D (3D Viewport) mô phỏng xếp hàng container (`/match-groups/[id]` hoặc modal 3D) sẽ sử dụng nền tối (`#090D16` / `#0F172A`) vì lòng thùng container và các kiện hàng đa màu sắc của 12 chủ hàng chỉ hiển thị rõ nét, tương phản cao trên nền tối.

### 1.2. Bảng mã màu đo lường chính xác từ Pixel Mockup (Color Tokens)

| Token Name | Mã Hex Đo thực tế | Tên gọi Thiết kế | Ứng dụng cụ thể |
|---|---|---|---|
| `--color-bg-app` | `#F8FAFC` | App Canvas Background | Nền toàn bộ trang web (Light mode) |
| `--color-surface-card` | `#FFFFFF` | Pure White Surface | Nền thẻ Card, Hộp thoại Modal, Khung bảng |
| `--color-surface-subtle`| `#F0F4FA` | Subtle Gray Box | Nền ô vuông bo góc chứa icon bên trái input |
| `--color-surface-hover` | `#F1F5F9` | Slate 100 Hover | Nền khi hover vào dòng bảng hoặc card |
| `--color-primary` | `#0D7CF7` | Electric Brand Blue | Nút bấm chính ("Tiếp tục", "Đăng ký", "Đăng hàng", "Quét mã") |
| `--color-primary-hover` | `#0A68D1` | Primary Hover | Trạng thái hover của nút bấm chính |
| `--color-primary-active`| `#0854A8` | Primary Active | Trạng thái nhấn giữ nút bấm |
| `--color-primary-tint` | `#EFF6FF` | Blue Ice Tint | Nền thẻ đang chọn (LCL selected), icon background |
| `--color-border-input` | `#DCE1EA` | Input Border Gray | Đường viền ô nhập liệu, dropdown |
| `--color-border-subtle`| `#E2E8F0` | Divider Border | Đường kẻ ngăn cách giữa các nhóm thông tin |
| `--color-text-title` | `#0A192F` | Deep Navy Title | Tiêu đề màn hình H1, H2, tên công ty nổi bật |
| `--color-text-body` | `#1E293B` | Slate 800 Body | Nội dung văn bản chính, nhãn trường nhập liệu |
| `--color-text-secondary`| `#475569` | Slate 600 Subtitle | Văn bản mô tả phụ, hướng dẫn |
| `--color-text-muted` | `#94A3B8` | Slate 400 Placeholder| Chữ mờ placeholder, ghi chú đếm ký tự |
| `--color-badge-verified-bg` | `#DAF6F9` | Mint Ice | Nền badge "Đã xác minh", "Đã xác thực" |
| `--color-badge-verified-text`| `#23A19E` | Deep Teal | Chữ và icon check của badge "Đã xác minh" |
| `--color-badge-ready-bg` | `#FEF5E4` | Warm Amber Tint | Nền badge "Sẵn sàng sử dụng" |
| `--color-badge-ready-text` | `#D97706` | Amber Text | Chữ của badge "Sẵn sàng sử dụng" |
| `--color-viewport-3d` | `#090D16` | Container Dark Viewport | Nền không gian 3D Three.js (Ngoại lệ có chủ đích) |

### 1.3. Thang Spacing Chuẩn
- `space-1`: `4px`
- `space-2`: `8px`
- `space-3`: `12px`
- `space-4`: `16px` (Padding card tiêu chuẩn)
- `space-6`: `24px` (Khoảng cách giữa các form section)
- `space-8`: `32px` (Lề container trang)

### 1.4. Quy định Chuẩn hóa Typography (Sans vs Mono)
- **Font Sans toàn bộ giao diện (`Montserrat`):** 
  - Toàn bộ giao diện người dùng (tiêu đề, nút bấm, nhãn trường, văn bản hướng dẫn, form nhập liệu MST, SĐT, số lượng...) sử dụng font Sans **`Montserrat`** chuẩn (nạp qua `next/font/google` với `subsets: ['latin', 'vietnamese']`, weights `[400, 500, 600, 700]`, `display: 'swap'`).
  - *Ghi chú quyết định thiết kế:* Đây là quyết định trực tiếp của người dùng nhằm mang lại phong cách typography hiện đại, đường nét hình học (geometric) rõ ràng, sang trọng và độ nhận diện thương hiệu cao hơn cho nền tảng Logistics 3D.
- **Font Mono (`JetBrains Mono` / `Geist Mono` với CSS `font-variant-numeric: tabular-nums;`) GIỮ NGUYÊN, CHỈ ÁP DỤNG CHO:**
  1. **Bảng dữ liệu (Data Tables):** Cột mã đơn, kích thước, khối lượng kg, thể tích CBM, giá cước.
  2. **Không gian 3D Viewport:** Tọa độ $(x, y, z)$, kích thước bao container và kích thước kiện hàng.
  3. **Bảng so sánh chi phí FWD & Hóa đơn CFS:** Bóc tách cước chính, phí handling, VAT, tổng cộng tiền tệ.
  4. **Mã kỹ thuật định danh:** Mã booking `BK-2026-0891`, mã container `CS-40HC-VNHPG-KRPUS-01`, mã niêm phong chì `S12345678`.

---

## 2. HỆ MÀU SEMANTIC CHO TRẠNG THÁI NGHIỆP VỤ (ĐO PIXEL THỰC TẾ)

Tất cả các màu trạng thái dưới đây được trích xuất bằng đo lường điểm ảnh thực tế từ các màn hình Mockup, đồng bộ hóa tuyệt đối giữa các bước:

| Tên Trạng thái (Tiếng Việt Chuẩn) | Nền Light (Bg) | Chữ Light (Text) | Viền Light (Border) | Nguồn Màn hình Xác thực |
|---|---|---|---|---|
| **Bản nháp** | `#F1F5F9` | `#475569` | `#CBD5E1` | Chuẩn hóa hệ thống |
| **Đang xác minh** | `#FEF5E4` | `#D97706` | `#FDE68A` | Màn 01-05 (Chờ duyệt) |
| **Đã xác minh** / **Đã xác thực** | `#DAF6F9` | `#23A19E` | `#A5F3FC` | Màn 01-07, 06-01 (Profile) |
| **Sẵn sàng sử dụng** | `#FEF5E4` | `#D97706` | `#FDE68A` | Màn 01-06 (Thành công) |
| **Đang xử lý** / **Chờ hàng đi** | `#E0F6FD` | `#0284C7` | `#7DD3FC` | Màn 03-07, 04-03 (Lô hàng) |
| **Chờ bàn giao** / **Chờ gom hàng** | `#FFF7ED` | `#FD791C` | `#FED7AA` | Màn 07-02, 08-02 (Kho CFS) |
| **Đang bàn giao** / **Đang gom hàng** | `#F0FDF4` | `#168168` | `#A7F3D0` | Màn 07-02, 08-02 (Hiện trường) |
| **Chờ đóng container** | `#E0F2FE` | `#0284C7` | `#BAE6FD` | Màn 08-02 (Bãi CFS) |
| **Đã ghép** / **Đã đóng cont** | `#DCFCE7` | `#16A34A` | `#86EFAC` | Màn 04-09, 08-07, 08-08 |
| **Đã bàn giao** / **Đã xếp xong** | `#DCFCE7` | `#16A34A` | `#86EFAC` | Màn 07-02, 08-07 |
| **Đã xác nhận** | `#CCFBF1` | `#0F766E` | `#5EEAD4` | Màn 02-06, 05-08 |
| **Đang vận chuyển** | `#F0FDF4` | `#16A34A` | `#86EFAC` | Màn 09-01 (Tracking cont) |
| **Đã giao** / **Hoàn tất** | `#DCFCE7` | `#16A34A` | `#86EFAC` | Màn 07-09, 09-04 (Giao xong) |
| **Đã hủy** | `#FFE4E6` | `#BE123C` | `#FDA4AF` | Chuẩn hóa hệ thống |

---

## 3. BẢNG MÀU 12 CHỦ HÀNG TRONG KHÔNG GIAN 3D & KIỂM ĐỊNH TOÁN HỌC CIEDE2000 + TỶ LỆ TƯƠNG PHẢN (CONTRAST RATIO)

### 3.1. Yêu cầu Hiển thị Thực tế & Biện pháp Hiệu chỉnh Độ tương phản
- **Vấn đề của bộ màu trước:**
  - Các màu quá tối như `#78350F` (nâu cocoa, CR = 2.14:1) và `#581C87` (tím đậm, CR = 1.79:1) bị chìm hoàn toàn vào lòng container nền tối (`#090D16`).
  - Các màu quá sáng như `#CBD5E1` (bạc, CR = 13.09:1), `#6EE7B7` (mint nhạt, CR = 12.75:1), `#FACC15` (vàng chanh, CR = 12.69:1) vượt ngưỡng 12:1 gây lóa mắt và mất chi tiết wireframe.
  - Màu `#FDA4AF` (salmon nhạt) quá bợt, dễ hòa lẫn khi render 3D có đổ bóng (shading).
- **Tiêu chuẩn hiệu chuẩn kép (Dual Calibration Standard):**
  1. **Độ tương phản WCAG với nền container `#090D16`:** Bắt buộc nằm nghiêm ngặt trong khoảng **$3.0:1 \le CR \le 12.0:1$** (dưới 3:1 là chìm, trên 12:1 là chói lóa).
  2. **Độ phân tách màu CIEDE2000 ($\Delta E$):** Khoảng cách giữa 12 màu với nhau $\ge 15.0$, và khoảng cách tới 5 điểm neo trạng thái hệ thống (Semantic Anchors) $\ge 14.5$.

### 3.2. Bảng 12 Màu Chủ Hàng 3D Đã Hiệu Chuẩn Tương Phản & Tách Màu

| Chủ Hàng | Mã Hex Bề mặt | Tên Màu | Mã Wireframe | Tỷ lệ Tương phản trên `#090D16` | Trạng thái CR (3:1 - 12:1) | Điểm neo Semantic gần nhất ($\Delta E$) |
|---|---|---|---|---|---|---|
| **Chủ hàng 1** | `#D946EF` | Hot Magenta | `#F0ABFC` | **5.62:1** | ĐẠT (Chuẩn) | $31.81$ (Brand Blue) |
| **Chủ hàng 2** | `#EAB308` | Ochre Mustard | `#FEF08A` | **10.13:1** | ĐẠT (Chuẩn) | $24.42$ (Warning Amber) |
| **Chủ hàng 3** | `#38BDF8` | Glacial Sky Cyan | `#BAE6FD` | **9.07:1** | ĐẠT (Chuẩn) | $21.58$ (Verified Teal) |
| **Chủ hàng 4** | `#84CC16` | Chartreuse Lime | `#BEF264` | **9.84:1** | ĐẠT (Chuẩn) | $18.21$ (Success Green) |
| **Chủ hàng 5** | `#F472B6` | Soft Pink Blush | `#FBCFE8` | **7.34:1** | ĐẠT (Chuẩn) | $24.79$ (Error Red) |
| **Chủ hàng 6** | `#7C3AED` | Electric Violet | `#A78BFA` | **3.41:1** | ĐẠT (Chuẩn) | $23.43$ (Brand Blue) |
| **Chủ hàng 7** | `#D4B996` | Warm Sand Tan | `#F5EBE0` | **10.34:1** | ĐẠT (Chuẩn) | $22.85$ (Warning Amber) |
| **Chủ hàng 8** | `#94A3B8` | Medium Slate Gray | `#CBD5E1` | **7.58:1** | ĐẠT (Chuẩn) | $18.82$ (Brand Blue) |
| **Chủ hàng 9** | `#BE185D` | Bright Berry Rose | `#FDA4AF` | **3.22:1** | ĐẠT (Chuẩn) | $20.61$ (Error Red) |
| **Chủ hàng 10**| `#4D7C0F` | Olive Forest Green| `#A3E635` | **3.89:1** | ĐẠT (Chuẩn) | $15.78$ (Success Green) |
| **Chủ hàng 11**| `#B45309` | Desert Amber | `#FDE68A` | **3.87:1** | ĐẠT (Chuẩn) | $17.75$ (Warning Amber) |
| **Chủ hàng 12**| `#64748B` | Steel Slate Blue | `#94A3B8` | **4.08:1** | ĐẠT (Chuẩn) | $14.82$ (Brand Blue) |

### 3.3. Báo cáo Kiểm định Thực nghiệm (Contrast Ratio & CIEDE2000 Verification Log)
```text
=== 1. KIỂM TRA TỶ LỆ TƯƠNG PHẢN (CONTRAST RATIO) TRÊN NỀN CONTAINER #090D16 ===
Ngưỡng yêu cầu: 3.0:1 <= CR <= 12.0:1 (Dưới 3:1: chìm vào nền tối; Trên 12:1: chói lóa mắt)
Luminance nền #090D16: 0.004039

Chủ hàng 1    #D946EF (Hot Magenta       ):  5.62:1 [ĐẠT]
Chủ hàng 2    #EAB308 (Ochre Mustard     ): 10.13:1 [ĐẠT]
Chủ hàng 3    #38BDF8 (Glacial Sky Cyan  ):  9.07:1 [ĐẠT]
Chủ hàng 4    #84CC16 (Chartreuse Lime   ):  9.84:1 [ĐẠT]
Chủ hàng 5    #F472B6 (Soft Pink Blush   ):  7.34:1 [ĐẠT]
Chủ hàng 6    #7C3AED (Electric Violet   ):  3.41:1 [ĐẠT]
Chủ hàng 7    #D4B996 (Warm Sand Tan     ): 10.34:1 [ĐẠT]
Chủ hàng 8    #94A3B8 (Medium Slate Gray ):  7.58:1 [ĐẠT]
Chủ hàng 9    #BE185D (Bright Berry Rose ):  3.22:1 [ĐẠT]
Chủ hàng 10   #4D7C0F (Olive Forest Green):  3.89:1 [ĐẠT]
Chủ hàng 11   #B45309 (Desert Amber      ):  3.87:1 [ĐẠT]
Chủ hàng 12   #64748B (Steel Slate Blue  ):  4.08:1 [ĐẠT]

=> KẾT LUẬN 1: 100% 12 màu đều đạt dải tỷ lệ tương phản an toàn (3.22:1 đến 10.34:1).
Không có màu nào bị chìm vào nền đen container và không có màu nào bị cháy sáng.

=== 2. KIỂM TRA KHOẢNG CÁCH CIEDE2000 ĐẾN 5 ĐIỂM NEO SEMANTIC (NGƯỠNG >= 14.5) ===
Chủ hàng 1    #D946EF -> gần nhất với Brand Blue (#0D7CF7)    : dE = 31.81 [ĐẠT]
Chủ hàng 2    #EAB308 -> gần nhất với Warning Amber (#FD791C) : dE = 24.42 [ĐẠT]
Chủ hàng 3    #38BDF8 -> gần nhất với Verified Teal (#23A19E) : dE = 21.58 [ĐẠT]
Chủ hàng 4    #84CC16 -> gần nhất với Success Green (#16A34A) : dE = 18.21 [ĐẠT]
Chủ hàng 5    #F472B6 -> gần nhất với Error Red (#EF4444)     : dE = 24.79 [ĐẠT]
Chủ hàng 6    #7C3AED -> gần nhất với Brand Blue (#0D7CF7)    : dE = 23.43 [ĐẠT]
Chủ hàng 7    #D4B996 -> gần nhất với Warning Amber (#FD791C) : dE = 22.85 [ĐẠT]
Chủ hàng 8    #94A3B8 -> gần nhất với Brand Blue (#0D7CF7)    : dE = 18.82 [ĐẠT]
Chủ hàng 9    #BE185D -> gần nhất với Error Red (#EF4444)     : dE = 20.61 [ĐẠT]
Chủ hàng 10   #4D7C0F -> gần nhất với Success Green (#16A34A) : dE = 15.78 [ĐẠT]
Chủ hàng 11   #B45309 -> gần nhất với Warning Amber (#FD791C) : dE = 17.75 [ĐẠT]
Chủ hàng 12   #64748B -> gần nhất với Brand Blue (#0D7CF7)    : dE = 14.82 [ĐẠT]

=> KẾT LUẬN 2: Điểm tiệm cận gần nhất là Chủ hàng 12 vs Brand Blue (dE = 14.82 >= 14.5).
Tuyệt đối không kiện hàng nào bị nhầm với màu biểu thị trạng thái hệ thống.

=== 3. CÁC CẶP GẦN NHAU NHẤT NỘI BỘ GIỮA 12 MÀU CHỦ HÀNG (NGƯỠNG >= 15.0) ===
Chủ hàng 1  (#D946EF) vs Chủ hàng 5  (#F472B6) -> dE = 16.43 [ĐẠT]
Chủ hàng 8  (#94A3B8) vs Chủ hàng 12 (#64748B) -> dE = 16.61 [ĐẠT]
Chủ hàng 3  (#38BDF8) vs Chủ hàng 8  (#94A3B8) -> dE = 17.35 [ĐẠT]
Chủ hàng 2  (#EAB308) vs Chủ hàng 7  (#D4B996) -> dE = 17.59 [ĐẠT]
Chủ hàng 1  (#D946EF) vs Chủ hàng 6  (#7C3AED) -> dE = 17.65 [ĐẠT]
Chủ hàng 6  (#7C3AED) vs Chủ hàng 12 (#64748B) -> dE = 18.46 [ĐẠT]
Chủ hàng 5  (#F472B6) vs Chủ hàng 9  (#BE185D) -> dE = 24.18 [ĐẠT]
Chủ hàng 4  (#84CC16) vs Chủ hàng 10 (#4D7C0F) -> dE = 25.06 [ĐẠT]
Chủ hàng 1  (#D946EF) vs Chủ hàng 8  (#94A3B8) -> dE = 25.47 [ĐẠT]
Chủ hàng 7  (#D4B996) vs Chủ hàng 8  (#94A3B8) -> dE = 25.99 [ĐẠT]

=> KHOẢNG CÁCH NỘI BỘ NHỎ NHẤT: dE = 16.43 (VƯỢT NGƯỠNG AN TOÀN 15.0).
Đảm bảo 12 kiện hàng của 12 chủ hàng khi xếp đan xen trong lòng container tối 
đều có thể phân biệt tức thì, độc lập và rõ ràng.
```

---

## 4. DANH MỤC COMPONENT & MA TRẬN 7 TRẠNG THÁI

### 4.1. Cấu trúc Trường Nhập liệu (Form Input with Icon Box)
- **Đặc trưng thiết kế Mockup:** Mỗi trường input có một ô vuông bo góc nền xám nhạt (`#F0F4FA`, kích thước `40x40px`, `rounded-xl`) nằm bên trái chứa icon đại diện.
- **7 Trạng thái:**
  1. `Default` (từ ảnh): Chiều cao input `44px`, viền `#DCE1EA`, bo góc `12px`, nền trắng `#FFFFFF`.
  2. `Hover` (đề xuất): Viền chuyển sang `#CBD5E1`.
  3. `Focus / Active` (đề xuất): Viền chuyển `#0D7CF7`, vòng hào quang `ring-2 ring-blue-500/20`.
  4. `Disabled` (đề xuất): Nền xám `#F1F5F9`, chữ `#94A3B8`, icon box mờ 50%.
  5. `Loading` (đề xuất): Icon bên trái đổi thành spinner `animate-spin`.
  6. `Error` (đề xuất): Viền đỏ `#EF4444`, hào quang `ring-2 ring-red-500/20`, hiện nhãn báo lỗi chữ đỏ.
  7. `Empty` (đề xuất): Hiển thị placeholder màu `#94A3B8`.

### 4.2. Thanh Tiến trình Bước (Linear Stepper with Counter)
- **Đặc trưng thiết kế Mockup:** Stepper là thanh ngang mảnh (`height: 4px`, nền track `#E2E8F0`, phần trăm hoàn thành tô màu `#0D7CF7`) kết hợp với chỉ số bước dạng chữ **"1/5", "2/5", "3/6"** đặt ở góc trên bên phải tiêu đề màn hình.

### 4.3. Nút Bấm Hành Động (Button Component & Vị trí Bố cục)
- **Vị trí bố cục Desktop vs Mobile:**
  - *Trên Mobile Mockup:* Nút hành động chính dính đáy màn hình (`fixed bottom-0`).
  - *Trên Web Desktop:* Nút hành động chính **NẰM Ở CUỐI FORM (In-flow)**, cùng trục với nội dung nhập liệu, căn lề phải hoặc toàn chiều rộng cột form, **tuyệt đối không dính đáy màn hình viewport**.
- **Kích thước Touch Target CFS (Mobile/Tablet):** Nút bấm và vùng chạm tối thiểu `48x48px` để thao tác găng tay/một tay tại bãi kho.

---

## 5. PHÂN TÍCH CHI TIẾT TỪNG MÀN HÌNH (TOÀN BỘ 9 THƯ MỤC)

### 5.1. Thư mục 01: Đăng ký tài khoản Chủ hàng (Shipper)
*(8 màn hình: Landing, Chọn vai trò, Thông tin DN, Liên hệ & GPKD, Chờ xác minh, Thành công, Hồ sơ cá nhân & KPI, Onboarding).*
- Tiêu đề Navy `#0A192F`, Stepper thanh ngang `2/5`, icon box `#F0F4FA`, nút "Tiếp tục" `#0D7CF7`. Form gồm Tên công ty, MST, Địa chỉ, Loại hình DN, Đại diện, SĐT, Email, Website, Chức vụ và Tải GPKD.

### 5.2. Thư mục 02: Đăng ký tài khoản Đối tác FWD & CFS
*(12 màn hình: 6 màn FWD + 6 màn CFS).*
- **FWD:** Nhập thông tin DN, Liên hệ, Năng lực & Tuyến (Pill toggle `[LCL] / [FCL]`, nút `+ Thêm tuyến`, Loại hàng, Tần suất), Giới thiệu công ty (0/500 ký tự), Cam kết 2 điều khoản.
- **CFS:** Nhập thông tin bãi, Diện tích kho ($m^2$), Sức chứa (CBM), 4 loại hàng tiếp nhận (Hàng khô, Hàng lạnh, Hàng nguy hiểm, Hàng quá khổ), Gói dịch vụ kho và Tải chứng chỉ PCCC/TAPA.

### 5.3. Thư mục 03: Quy trình Đăng hàng LCL & Chi tiết Đơn hàng
*(8 màn hình: Hub đăng hàng, Wizard 4 bước, Màn thành công, Chi tiết đơn hàng).*
- Chọn tuyến (Điểm đi, Điểm đến, Toggle Nội địa/Quốc tế, Chọn phương thức LCL).
- Nhập kiện: Loại hàng, Tên hàng, Số lượng (Thùng), Trọng lượng (Kg), Kích thước D x R x C (cm), Trị giá VND.
- Lịch trình: Ready date, Cut-off date, Đính kèm chứng từ (10MB).
- Chi tiết đơn: Mã `LH250515001`, Badge `Đang xử lý` (`#E0F6FD`), 3 Tab Thông tin - Lịch trình - Đối tác, Stepper tiến trình 4 mốc.

### 5.4. Thư mục 04: Ghép nối Lô hàng & Mô phỏng Xếp container 3D
*(10 màn hình: Hub ghép hàng, Tìm tuyến, Kết quả tìm kiếm, Chi tiết đối tác ghép, 3D Packing View, Ghép chiều về, Tỷ lệ lấp đầy, Cargo Manifest chi tiết, Ghép hàng thành công).*
- Tìm kiếm cơ hội ghép LCL theo tuyến (`Hà Nội -> Đà Nẵng`, 10 CBM).
- **Mô phỏng 3D Container:** Chuyển đổi tab `[ Container 1 ]`, `[ Container 2 ]`, trực quan kiện hàng của từng chủ hàng phân biệt màu rõ ràng.
- Hiển thị tỷ lệ lấp đầy thể tích CBM và tải trọng trục xe (Axle load).

### 5.5. Thư mục 05: Gợi ý Chi phí & Lựa chọn FWD Phù hợp
*(8 màn hình: Hub tính phí, 4 bước Wizard, Bảng bóc tách hóa đơn, So sánh đa chiều các FWD, Hoàn tất chọn FWD).*
- Bộ tính cước nhanh: Tuyến đường, loại phương thức (Biển / Hàng không / Đường bộ).
- Bảng bóc tách chi phí chi tiết: Cước chính, Phụ phí xăng dầu BAF, Phí chứng từ, Handling cảng, VAT 8%.
- Ma trận so sánh 5 FWD đối chiếu thời gian và giá cước trọn gói.

### 5.6. Thư mục 06: Thông tin FWD Hiển thị (Bản Công khai vs Bản Sau kết nối)
*(2 màn hình phân quyền bảo mật)*
- **Bản Công khai:** Hiển thị tên, sao đánh giá, tuyến mạnh, giá cước tham khảo; che giấu SĐT, Email, Tên người phụ trách; có banner khóa yêu cầu kết nối.
- **Bản Sau kết nối:** Hiển thị đầy đủ MST, Hotline, Email điều độ, địa chỉ trụ sở sau khi được duyệt kết nối.

### 5.7. Thư mục 07: Bàn giao Hàng hóa tại Kho CFS (Touch-First Mobile/Tablet)
*(10 màn hình phân tích trực tiếp từ mockups)*

#### Màn 07-01: CFS Hub Quản lý Tiếp nhận
- **Vai trò:** Thủ kho CFS, Nhân viên giao nhận hiện trường.
- **Thông tin hiển thị:** Lời chào "Hương Hồ Thu (Chi nhánh B)", Banner "Bàn giao hàng hóa tại kho CFS - Nhanh chóng - Chính xác - Minh bạch", Lưới 6 nút chức năng: Đặt chỗ kho, Bàn giao hàng, Theo dõi hàng, Chi phí, FWD phù hợp, Thông báo. Card thông tin nhanh: *"Có 2 container đang chờ bàn giao tại kho CFS"*.
- **Thao tác:** Chạm vào "Bàn giao hàng hóa" để xem danh sách container cần tiếp nhận.

#### Màn 07-02: Danh sách Đơn Bàn giao tại Kho
- **Vai trò:** Thủ kho CFS.
- **Thông tin hiển thị:**
  - Bộ lọc tabs: `[ Tất cả ]`, `[ Chờ bàn giao ]`, `[ Đã bàn giao ]`.
  - Ô tìm kiếm: Mã đơn, container, loại hàng.
  - Danh sách thẻ đơn bàn giao:
    1. Mã `GH250518001` — Badge `Chờ bàn giao` (`#FFF7ED`, chữ `#FD791C`), Cont `TCLU1234567`, Hàng điện tử máy móc, Giờ hẹn: `18/05/2025 08:00 - 12:00`.
    2. Mã `GH250517002` — Badge `Đang bàn giao` (`#F0FDF4`, chữ `#168168`), Cont `MSKU7654321`.
    3. Mã `GH250516003` — Badge `Đã bàn giao` (`#DCFCE7`, chữ `#16A34A`), Cont `TEMU9876543`.
- **Thao tác:** Chạm vào thẻ đơn hoặc bấm nút `+ Tạo yêu cầu bàn giao mới`.

#### Màn 07-03: Chi tiết Đơn Bàn giao LCL
- **Vai trò:** Thủ kho CFS / Tài xế xe tải.
- **Thông tin hiển thị:** Mã đơn `GH250518001`, Cont `TCLU1234567`. Thông số hàng: 10 kiện, 5.000 kg, 12.5 CBM. Thông tin kho: CFS Hải Phòng (Số 1 Đình Vũ), Hotline `0225 383 6688`.
- **Thao tác:** Bấm nút lớn "Tiến hành bàn giao ->".

#### Màn 07-04: Wizard Bàn giao Bước 1/4 - Xác nhận Thông tin
- **Vai trò:** Nhân viên kho CFS.
- **Thông tin hiển thị:** Stepper 4 bước (1. Xác nhận thông tin, 2. Kiểm tra hàng hóa, 3. Bàn giao tại kho, 4. Hoàn tất). Kiểm tra số cont, kho CFS, giờ bàn giao thực tế (`18/05/2025 08:00`).
- **Thao tác:** Bấm "Tiếp tục ->".

#### Màn 07-05: Wizard Bước 2/4 - Quét mã QR / Barcode Kiện hàng
- **Vai trò:** Nhân viên kho cầm máy quét hoặc điện thoại.
- **Thông tin hiển thị:** Khung quét camera trực tiếp kèm ô căn chỉnh QR màu xanh neon. Hướng dẫn: *"Quét mã trên kiện hàng để kiểm tra thông tin và xác nhận số lượng"*.
- **Thao tác:** Bấm nút lớn "Quét mã" (mở camera) hoặc bấm "Nhập thủ công".

#### Màn 07-06: Bảng Kiểm đếm Kiện hàng (Tally Sheet)
- **Vai trò:** Nhân viên kiểm đếm (Tallyman) tại cửa kho.
- **Thông tin hiển thị:**
  - Cont `TCLU1234567`, Badge `Đang kiểm tra`.
  - Danh sách đối soát 10 dòng: STT, Mã kiện, Số lượng, Trạng thái.
    - KI-001: 100 — `Đúng` (Check xanh)
    - KI-002: 100 — `Đúng`
    - KI-003: 50 — `Đúng`
    - KI-004: 50 — **`Thiếu 5` (Badge cam cảnh báo sai lệch kiểm đếm)**
    - KI-005 đến KI-010: 100 — `Đúng`.
- **Thao tác:** Xác nhận số lượng thực tế, bấm "Xác nhận kiểm tra".

#### Màn 07-07: Wizard Bước 3/4 - Hồ sơ & Chụp ảnh Nghiệm thu Hiện trường
- **Vai trò:** Nhân viên kho CFS.
- **Thông tin hiển thị:**
  - Mục Biên bản: Tệp `Bien ban ban giao hang hoa.pdf` (2.4 MB) kèm nút tải lên.
  - Mục Hình ảnh hàng hóa: Lưới hiển thị các ảnh thực tế chụp thùng hàng, kiện hàng trên pallet xe nâng, ô nút bấm `+ Thêm ảnh` (mở camera chụp tức thì hàng móp méo/hư hỏng).
  - Khung ghi chú tình trạng bảo quản.
- **Thao tác:** Chụp ảnh, đính kèm biên bản, bấm "Tiếp tục ->".

#### Màn 07-08: Wizard Bước 4/4 - Bàn giao Hàng hóa Thành công!
- **Vai trò:** Nhân viên kho & Người giao hàng.
- **Thông tin hiển thị:** Huy hiệu check xanh lá lớn + pháo hoa confetti. Tiêu đề: *"Bàn giao hàng hóa thành công! Hàng hóa đã được bàn giao tại kho CFS theo đúng thông tin và số lượng"*. Card tóm tắt mã `GH250518001`, Cont `TCLU1234567`, Thời gian `18/05/2025 08:15`.
- **Thao tác:** Bấm "Xem chi tiết đơn" hoặc "Về trang chủ".

#### Màn 07-09: Theo dõi Tiến trình Bàn giao (Audit Timeline)
- **Vai trò:** Chủ hàng, FWD theo dõi từ xa.
- **Thông tin hiển thị:** Timeline thời gian thực:
  1. `07:32` — Đã tiếp nhận yêu cầu.
  2. `08:05` — Đang kiểm tra hàng hóa.
  3. `08:15` — Đã bàn giao tại kho CFS (Active).
  4. `08:30` — Hoàn tất nhập kho.
- **Thao tác:** Bấm xem tệp ảnh và biên bản đính kèm.

#### Màn 07-10: Chi tiết Chi phí Dịch vụ Kho CFS
- **Vai trò:** Chủ hàng thanh toán & Kế toán CFS.
- **Thông tin hiển thị:**
  - Mã đơn `GH250518001`, Badge `Đã bàn giao`.
  - Bảng phí kho: Phí lưu kho CFS `1.200.000 VND`, Phí bốc xếp nâng hạ `800.000 VND`, Phí chứng từ `300.000 VND`, Thuế VAT (8%) `264.000 VND`. Tổng cộng: `2.564.000 VND`.
  - Nút tải tệp PDF: `Biên bản bàn giao.pdf`, `Hóa đơn CFS.pdf`.
- **Thao tác:** Tải hóa đơn VAT hoặc quay lại danh sách.

---

### 5.8. Thư mục 08: Gom hàng & Đóng Container (CFS Stuffing & Inspection)
*(10 màn hình phân tích trực tiếp từ mockups)*

#### Màn 08-01 & 08-02: Danh sách Kế hoạch Gom hàng Đóng Cont
- **Vai trò:** Trưởng bãi CFS & Điều độ FWD.
- **Thông tin hiển thị:** Thống kê container đang chờ đóng bãi; Danh sách thẻ: Cont `TCLU1234567` (Badge `Chờ gom hàng`), Cont `MSKU7654321` (Badge `Đang gom hàng`), Cont `TEMU9876543` (Badge `Chờ đóng container`).
- **Thao tác:** Bấm `+ Tạo yêu cầu gom hàng` hoặc chọn container để mở kế hoạch xếp.

#### Màn 08-03: Phương án Xếp hàng 3D Dự kiến (Loading Plan 3D)
- **Vai trò:** Điều độ viên CFS.
- **Thông tin hiển thị:** Container 20ft, Hàng điện tử máy móc, Thể tích `12.5 m³`. Mô hình 3D container kèm thanh tiến trình tổng thể tích chiếm chỗ `85%`. Phân bổ hàng theo kích cỡ: Hàng lớn (6 kiện - cam), Hàng trung (8 kiện - xanh), Hàng nhỏ (12 kiện - xám).
- **Thao tác:** Bấm nút "Xem chi tiết 3D".

#### Màn 08-04 & 08-05: Kiểm đếm Gom hàng Thực tế tại Cửa Kho
- **Vai trò:** Công nhân bãi xe nâng.
- **Thông tin hiển thị:** Stepper 3 bước (1. Gom hàng, 2. Xếp hàng 3D, 3. Đóng container). Checkbox gom từng lô: `[x] Điện tử 6 kiện 7.2 m³`, `[x] Dệt may 8 kiện 4.8 m³`, `[x] Phụ kiện 12 kiện 3.0 m³`. Ảnh chụp hiện trường xe nâng bốc hàng pallet. Xác nhận: *"Đã gom đủ hàng theo phương án: 26 kiện, 15.0 m³, 8.5 tấn"*.
- **Thao tác:** Bấm nút "Hoàn tất gom hàng".

#### Màn 08-06 & 08-07: Xếp hàng vào Container theo Mô hình 3D
- **Vai trò:** Công nhân đóng cont (Stuffing team).
- **Thông tin hiển thị:** Vòng tròn tiến độ xếp hàng `70%` (Đã xếp 18/26 kiện, `10.5 m³ / 15.0 m³`). Hướng dẫn: *"Dựa theo phương án xếp hàng 3D để sắp xếp hàng hóa vào container"*. Khi xếp xong: Badge xanh `Đã xếp xong`, mô hình 3D cont đầy 100%.
- **Thao tác:** Bấm "Xác nhận xếp hàng".

#### Màn 08-08: Nghiệm thu Niêm phong Chì (Container Seal Verification)
- **Vai trò:** Giám sát kho CFS & Hải quan giám sát.
- **Thông tin hiển thị:**
  - Ảnh chụp thực tế hai cánh cửa container đóng chặt và kẹp chì niêm phong.
  - 3 tiêu chí an toàn bắt buộc:
    - `[x] Đã sắp xếp hàng hóa đúng phương án 3D`
    - `[x] Đã kiểm tra tình trạng container (vỏ cont kín nước, không rách méo)`
    - `[x] Đã niêm phong chì container`
  - Thông tin niêm phong: Số Seal (`Seal No: S12345678`), Thời gian bấm chì (`18/05/2025 11:30`).
- **Thao tác:** Bấm "Hoàn tất đóng container".

#### Màn 08-09: Hoàn tất Đóng Container Thành công
- **Vai trò:** Quản lý kho CFS & FWD.
- **Thông tin hiển thị:** Check xanh chúc mừng: *"Gom hàng và đóng container thành công! Hàng hóa đã được gom đầy đủ, sắp xếp theo phương án 3D và đóng container tại kho CFS."* Tóm tắt mã đơn, số container, kho và mốc giờ hoàn tất.
- **Thao tác:** Bấm "Xem chi tiết đơn" hoặc "Về trang chủ".

---

### 5.9. Thư mục 09: Trạng thái Vận chuyển & Đánh giá 3 Bên (End-to-End Tracking)
*(8 màn hình phân tích trực tiếp từ mockups)*

#### Màn 09-01: Theo dõi Đơn hàng Tổng quan (Milestone Overview)
- **Vai trò:** Chủ hàng (Shipper) & Người nhận hàng (Consignee).
- **Thông tin hiển thị:**
  - Mã container: `TCLU1234567` — Badge xanh `Đang vận chuyển` (`#F0FDF4`, chữ `#16A34A`).
  - Kho xuất phát: CFS Hải Phòng, Ngày gửi: `18/05/2025`.
  - Stepper tiến độ 4 mốc: `Đã gom hàng` (Checked) -> `Vận chuyển` (Active) -> `Đến cảng` -> `Giao hàng`.
  - Danh sách 4 sự kiện hành trình đầu: Đã gom tại CFS (18/05 08:00), Rời kho CFS (18/05 12:30), Đến cảng Hải Phòng làm thủ tục HQ (19/05 08:15), Xếp lên tàu biển (20/05 16:40).
- **Thao tác:** Bấm "Xem chi tiết hành trình".

#### Màn 09-02: Chi tiết Toàn bộ Nhật ký Hành trình (Transit Log)
- **Vai trò:** Chủ hàng, FWD.
- **Thông tin hiển thị:** Mở rộng đầy đủ 7 mốc thời gian: Xếp lên tàu biển -> Đang trên biển (22/05 10:00, tàu MV Ocean Star) -> Đến cảng đích Singapore (25/05 09:00) -> Giao hàng tại kho đích (26/05 14:20).

#### Màn 09-03: Bản đồ Vị trí Trực tiếp (Live Sea Vessel GPS Map)
- **Vai trò:** Chủ hàng, FWD, Bảo hiểm hàng hải.
- **Thông tin hiển thị:**
  - Bản đồ đồ họa hàng hải thể hiện đường hải trình chấm đứt đoạn nối từ Cảng Hải Phòng qua Biển Đông đến Singapore.
  - Icon tàu biển định vị trực tiếp: Trạng thái *"Đang trên biển (gần Singapore)"*.
  - Tên tàu vận chuyển: `MV Ocean Star`.
  - Thời gian cập cảng dự kiến (ETA): `25/05/2025 - 09:00`.
- **Thao tác:** Thu phóng bản đồ, bấm "Xem lộ trình chi tiết".

#### Màn 09-04: Xác nhận Giao hàng Thành công (Proof of Delivery - POD)
- **Vai trò:** Người nhận hàng, FWD, Shipper.
- **Thông tin hiển thị:** Hình minh họa xe tải trả hàng trước kho khách hàng; Tiêu đề: *"Giao hàng thành công! Đơn hàng TCLU1234567 đã được giao thành công vào ngày 26/05/2025"*. Thông tin chi tiết: Thời gian giao `26/05/2025 - 14:20`, Địa chỉ kho: TP Hồ Chí Minh, Người nhận: `Nguyễn Văn A`, SĐT: `0987 654 321`.
- **Thao tác:** Bấm "Xem chi tiết đơn hàng" hoặc "Theo dõi đơn khác".

#### Màn 09-05: Đánh giá Chất lượng Dịch vụ Forwarder (FWD Rating)
- **Vai trò:** Chủ hàng đánh giá FWD.
- **Thông tin hiển thị:** Logo FWD, Đánh giá sao tổng quan (1 - 5 sao vàng), Ô viết nhận xét trải nghiệm, Bộ đánh giá 4 tiêu chí chuyên sâu (mỗi tiêu chí chọn 1-5 sao):
  1. *Tư vấn & hỗ trợ*
  2. *Thời gian vận chuyển*
  3. *Xử lý sự cố*
  4. *Thái độ nhân viên*
- **Thao tác:** Chấm sao, nhập nhận xét, bấm "Gửi đánh giá".

#### Màn 09-06: Đánh giá Chất lượng Khai thác Kho CFS (CFS Rating)
- **Vai trò:** Chủ hàng / FWD đánh giá đơn vị kho CFS.
- **Thông tin hiển thị:** Logo kho CFS, Đánh giá sao tổng quan, Nhận xét, 4 tiêu chí kho bãi:
  1. *Tốc độ gom hàng*
  2. *Chất lượng đóng gói & chèn lót*
  3. *An toàn hàng hóa*
  4. *Thái độ nhân viên kho*
- **Thao tác:** Bấm "Gửi đánh giá".

#### Màn 09-07: Đánh giá Trải nghiệm Nền tảng Logix-3D (App Rating)
- **Vai trò:** Người dùng hệ thống đánh giá phần mềm.
- **Thông tin hiển thị:** Logo Logix-3D, 4 tiêu chí kỹ thuật:
  1. *Giao diện & trải nghiệm (UI/UX)*
  2. *Tính năng mô phỏng xếp 3D*
  3. *Độ ổn định hệ thống*
  4. *Hỗ trợ khách hàng*
- **Thao tác:** Bấm "Gửi đánh giá".

#### Màn 09-08: Cảm ơn & Lưu Trữ Đánh giá Tín nhiệm
- **Vai trò:** Người dùng.
- **Thông tin hiển thị:** Minh họa nút Like ngón tay cái cùng bảng kẹp sao vàng confetti; Lời cảm ơn: *"Cảm ơn bạn! Đánh giá của bạn rất quan trọng và giúp chúng tôi cải thiện dịch vụ ngày càng tốt hơn"*.
- **Thao tác:** Bấm "Quay lại trang chủ" hoặc "Xem đánh giá của tôi".

---

## 6. ÁNH XẠ THIẾT KẾ TỪ MOBILE MOCKUP SANG WEB DESKTOP & THIẾT BỊ HIỆN TRƯỜNG

### 6.1. Nguyên tắc Phân chia Thiết bị theo Đặc thù Vận hành

1. **Chủ hàng (Shipper), Forwarder (FWD) và Admin -> DESKTOP WORKSTATION:**
   - Sử dụng màn hình máy tính lớn, xử lý đồng thời nhiều lô hàng, bảng biểu dày đặc số liệu.
   - Bố cục trung tâm là **Bảng dữ liệu (Data Table)** có sorting, filtering theo trạng thái, tìm kiếm đa cột, xuất Excel và bulk actions.
   - Nút hành động chính nằm ở cuối form nội dung, tuyệt đối không dính đáy màn hình.
2. **Khai thác Kho CFS (Thư mục 07) -> MOBILE & TABLET TOUCH-FIRST:**
   > [!IMPORTANT]
   > **GIỮ NGUYÊN BỐ CỤC TOUCH-FIRST CHO TOÀN BỘ PHÂN HỆ CFS (THƯ MỤC 07):**
   > - Nhân viên kho đứng tại cầu tàu, cửa kho, bãi container cầm máy tính bảng công nghiệp hoặc điện thoại thông minh.
   > - Giữ nguyên các nút bấm lớn (chiều cao tối thiểu `48px`, padding `16px`), ô nhập liệu to bản, hỗ trợ camera quét Barcode/QR Code kiện hàng tức thì.
   > - Tích hợp chụp ảnh hiện trường trực tiếp (chụp kiện hàng móp méo, chụp niêm phong chì seal) và tải lên ngay tại bãi.
3. **Gom hàng & Đóng Container (Thư mục 08) -> HYBRID (DESKTOP + TABLET):**
   - *Phần lập kế hoạch (FWD / Điều độ CFS):* Dùng Desktop để xem toàn cảnh 3D Viewport 65%, xoay lật container, kiểm tra phân bổ tải trọng trục xe và in sơ đồ xếp hàng (Stowage Plan).
   - *Phần thực thi xếp hàng (Công nhân bãi):* Dùng Tablet/Mobile tại cửa container để đánh dấu checklist từng kiện đã đưa vào thùng xe và chụp ảnh kẹp chì.
4. **Theo dõi Hành trình & Đánh giá (Thư mục 09) -> DESKTOP WORKSTATION:**
   - Chia 2 cột lớn: Cột trái 60% là **Bản đồ Hải trình Vệ tinh Trực tiếp (Live Marine GPS Map)**; Cột phải 40% là **Milestone Timeline** chi tiết từng chặng và bảng đánh giá sao 3 bên.

---

## 7. NGHIỆP VỤ BACKEND MỚI CẦN BỔ SUNG (BẢO VỆ THÔNG TIN LIÊN HỆ FWD)

Cơ chế phân quyền hiển thị thông tin FWD trong Thư mục 06 là một yêu cầu nghiệp vụ thực tế quan trọng nhằm bảo vệ mạng lưới đối tác và chống thất thoát giao dịch ngoài sàn:

### 7.1. Bảng Dữ liệu Mới trong Database (Prisma Schema)
```prisma
model ForwarderConnection {
  id                 String             @id @default(uuid())
  shipperCompanyId   String
  forwarderCompanyId String
  status             ConnectionStatus   @default(PENDING) // PENDING, CONNECTED, REJECTED
  shipmentId         String?
  quoteRequestId     String?
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  shipperCompany     Company            @relation("ShipperConnections", fields: [shipperCompanyId], references: [id])
  forwarderCompany   Company            @relation("FwdConnections", fields: [forwarderCompanyId], references: [id])
}
```

### 7.2. Logic Kiểm tra Quyền & Che giấu Dữ liệu (Data Masking)
- **Endpoint:** `GET /forwarders/:id`
  - Nếu người gọi API (Current User) chưa có bản ghi `ForwarderConnection` ở trạng thái `CONNECTED` với FWD này:
    - Backend tự động che giấu: `phone = null`, `email = null`, `contactPerson = null`, `taxCode = null`, `exactAddress = null` (chỉ trả về Tỉnh/Thành).
    - Trả về cờ `isContactMasked = true` và thông điệp hướng dẫn gửi yêu cầu kết nối.
  - Nếu đã kết nối hợp lệ hoặc có báo giá chính thức:
    - Trả về đầy đủ thông tin liên hệ và cờ `isContactMasked = false`.
- **Endpoint Kết nối:** `POST /forwarders/:id/connect` hoặc `POST /quotes/request` để khởi tạo yêu cầu.

---

## 8. ĐỐI CHIẾU CODEBASE HIỆN TẠI & KẾ HOẠCH VIẾT LẠI GIAO DIỆN

> [!WARNING]
> **VI PHẠM GIAO DIỆN NGHIÊM TRỌNG TRONG CODEBASE CŨ:**
> Các trang đã code trong `apps/web` (`login`, `register`, `shipments`, `match-groups`) hiện đang sử dụng **nền tối Slate-950 (`bg-slate-950`)**, chữ trắng, màu sắc tự do. Điều này vi phạm trực tiếp toàn bộ 9 bộ Mockup chuẩn.

### Kế hoạch Viết lại Toàn bộ Frontend theo Chuẩn Mockup:
1. **Cập nhật `globals.css` & `tailwind.config.ts`:**
   - Xóa bỏ việc áp đặt nền tối mặc định. Thiết lập `body` mặc định là nền sáng `#F8FAFC`, chữ `#1E293B`.
   - Khai báo toàn bộ Design Tokens đo thực tế (`#0D7CF7`, `#0A192F`, `#DCE1EA`, `#F0F4FA`, `#DAF6F9`, `#23A19E`...).
2. **Viết lại trang Đăng nhập & Đăng ký (`apps/web/src/app/(auth)/`):**
   - Chuyển sang nền sáng `#F8FAFC`, thẻ trắng `#FFFFFF`.
   - Áp dụng cấu trúc ô nhập liệu có icon box `#F0F4FA` bên trái.
   - Bổ sung quy trình đăng ký doanh nghiệp đầy đủ theo Stepper thanh ngang.
3. **Viết lại trang Quản lý Lô hàng (`apps/web/src/app/shipments/`):**
   - Chuyển bảng dữ liệu sang nền trắng, viền `#E2E8F0`.
   - Sử dụng đúng màu Semantic Badge và tên tiếng Việt: `Tìm đối tác`, `Đang ghép`, `Đã đóng cont`.
   - Cột số liệu áp dụng font Mono `tabular-nums`.
4. **Cấu trúc lại Màn hình 3D (`apps/web/src/app/match-groups/[id]/`):**
   - Chia 2 cột: Cột trái 65% là khung nhìn 3D Three.js giữ **nền tối `#090D16`** (ngoại lệ có chủ đích duy nhất); Cột phải 35% là bảng thông số container và danh sách kiện hàng nền sáng.
   - Gán màu kiện hàng theo đúng **Bảng màu 12 Chủ hàng Tối ưu CIEDE2000** ở Mục 3.

---

## 9. DANH SÁCH VẤN ĐỀ CẦN LÀM RÕ (UNCLEAR POINTS & DISCREPANCIES)

1. **Đơn vị kích thước `cm` vs `mm`:** Mockup hiển thị `cm` cho người dùng thân thiện (`120 x 80 x 60 cm`), nhưng thuật toán packing 3D cốt lõi và cơ sở dữ liệu xử lý theo `mm`. Giải pháp: Tầng UI cho phép nhập `cm`, tự động nhân 10 sang `mm` trước khi gửi API.
2. **Hỗ trợ lô hàng nhiều loại kiện (Multi-SKU):** Mockup chỉ thể hiện 1 loại kiện trong form. Đề xuất: Cho phép thêm nhiều dòng kiện (`+ Thêm loại kiện`) và nhập file Excel danh sách kiện hàng.
3. **Lỗi chính tả trong bản Mockup:** Đã ghi nhận các lỗi trong ảnh (CPS thay vì CFS, "Bãi chứa tái", "Giá thiệu ngắn") và đã chuẩn hóa trong tài liệu đặc tả này.
4. **Quy trình Quét Barcode/QR tại kho:** Mockup có màn quét QR camera. Cần thống nhất định dạng payload của mã QR dán trên pallet/thùng hàng (VD: JSON chuỗi chứa `shipmentId|packageCode|grossWeight`).
