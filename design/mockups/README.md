Tôi có bộ mockup thiết kế tại design/mockups/. Đây là mockup dạng 
MOBILE APP, trong khi sản phẩm của chúng ta là web. Đọc kỹ phần 
ánh xạ ở bước 2.

KHÔNG code UI từ ảnh. Làm 3 bước, dừng lại ở bước 3.

───────────────────────────────────────────────
BƯỚC 1 — Viết docs/design-spec.md

Xử lý 3 ảnh một đợt, ghi nối tiếp vào cùng file. Sau mỗi đợt dừng 
lại báo tôi trước khi đọc đợt tiếp theo.

Nội dung cần có:

a) Design tokens
   - Bảng màu đầy đủ mã hex, tách rõ light/dark
   - Thang spacing (4/8/12/16/24...)
   - Font family, size scale, font weight
   - Border radius, shadow

b) Màu semantic cho trạng thái nghiệp vụ
   Mỗi trạng thái ghi: tên tiếng Việt ĐÚNG NHƯ TRONG ẢNH + màu nền 
   + màu chữ + màu viền. Ví dụ "Chờ ghép", "Đang vận chuyển", 
   "Đã đóng cont".

c) Component nhận diện được
   Mỗi component ghi rõ các biến thể và ĐẦY ĐỦ trạng thái:
   default / hover / active / disabled / loading / error / empty.
   Ảnh chỉ vẽ trạng thái default — bạn phải tự đề xuất phần còn lại 
   và ghi rõ đó là đề xuất của bạn, không phải từ ảnh.

d) Với TỪNG màn trong ảnh
   - Màn này thuộc vai trò nào (Shipper/FWD/CFS/Admin)
   - Liệt kê chính xác những THÔNG TIN nào được hiển thị
   - Liệt kê những THAO TÁC nào có mặt
   Đây là phần giá trị nhất của mockup. Tôi cần biết bản thiết kế 
   quyết định hiển thị cái gì, chứ không phải nó trông thế nào.

───────────────────────────────────────────────
BƯỚC 2 — Mục "Ánh xạ Mobile sang Web" trong cùng file

Quy tắc:

LẤY từ ảnh:
  màu, font, icon, kiểu card, bo góc, cách đặt tên tiếng Việt, 
  và tập thông tin hiển thị trên mỗi màn

KHÔNG lấy từ ảnh:
  bố cục một cột, bottom tab bar, kiểu điều hướng mobile, 
  kích thước touch target cỡ điện thoại

Phân chia theo vai trò:
  - Shipper, FWD, Admin → thiết kế lại thành DESKTOP. Bảng là trung 
    tâm, sidebar điều hướng, mật độ thông tin cao, hỗ trợ phím tắt. 
    Đây là người ngồi bàn làm việc nhiều giờ.
  - CFS → GIỮ hướng mobile/tablet. Nhân viên kho đứng ở bãi cầm 
    điện thoại chụp ảnh nghiệm thu, touch target lớn, ít chữ, 
    thao tác một tay.

Với mỗi màn trong ảnh, viết một đoạn: layout web tương ứng sẽ như 
thế nào, cái gì chuyển từ card dọc thành cột bảng, cái gì gộp lại, 
cái gì tách ra.

Nếu có chỗ nào trong ảnh bạn không đọc rõ, hoặc thấy mâu thuẫn giữa 
các màn (cùng một trạng thái mà hai màn tô hai màu khác nhau chẳng 
hạn), ghi vào mục "Cần làm rõ" ở cuối file. Đừng tự đoán rồi im lặng.

───────────────────────────────────────────────
BƯỚC 3 — DỪNG. Đưa tôi duyệt design-spec.md.

Sau khi tôi duyệt:
- Toàn bộ token đưa vào CSS variable trong globals.css và 
  tailwind.config.ts
- MỌI component đọc token từ đó. Không hardcode mã màu hay số pixel 
  ở bất kỳ file component nào.
- Nếu cần một màu hay khoảng cách chưa có trong token, dừng lại hỏi 
  tôi để bổ sung vào spec, không tự chế giá trị mới tại chỗ.