# ADR 0006: In-Memory Access Token Storage and HttpOnly Refresh Cookie Architecture

## Status
Accepted

## Context
Trong các ứng dụng Single Page Application (SPA), việc lưu trữ thông tin xác thực đối mặt với nguy cơ bảo mật nghiêm trọng nếu cấu hình không đúng:
1. **Rủi ro rò rỉ Token qua tấn công XSS (Cross-Site Scripting):** Nếu lưu trữ `accessToken` trong `localStorage` hoặc `sessionStorage`, bất kỳ đoạn mã JavaScript độc hại nào (từ lỗ hổng XSS, gói thư viện npm thứ ba bị xâm nhập, hoặc tiện ích mở rộng trình duyệt) đều có thể gọi `localStorage.getItem('accessToken')` để đánh cắp token mà không cần tương tác của người dùng.
2. **Xung đột mục đích thiết kế bảo mật:** Hệ thống đã sử dụng cơ chế cookie `httpOnly`, `sameSite=Strict` cho `refreshToken` 7 ngày nhằm ngăn chặn JavaScript truy cập. Nếu lại lưu `accessToken` (dù thời hạn chỉ 15 phút) vào Web Storage, toàn bộ hàng rào bảo mật chống XSS sẽ bị vô hiệu hóa.
3. **Trải nghiệm người dùng khi mở tab mới hoặc F5:** Người dùng cần giữ trạng thái đăng nhập liền mạch giữa các tab và sau khi tải lại trang (F5) mà không bị đăng xuất đột ngột.

## Decision

### 1. Lưu Trữ Access Token Hoàn Toàn Trong Bộ Nhớ (In-Memory Only)
- `accessToken` được lưu trữ DUY NHẤT trong bộ nhớ RAM của tiến trình JavaScript (thông qua React state trong `AuthProvider` và biến module bộ nhớ trong `api-client.ts`).
- Tuyệt đối KHÔNG lưu `accessToken`, `user` profile hoặc bất kỳ token nào vào `localStorage` hay `sessionStorage`.
- Khi ứng dụng khởi động, mọi dấu vết cũ trong `localStorage` và `sessionStorage` (nếu có từ các phiên bản trước) sẽ bị xóa sạch lập tức.

### 2. Quản Lý Phiên Bằng HttpOnly Refresh Token Cookie
- Phiên đăng nhập dài hạn (7 ngày) được duy trì hoàn toàn bằng `refreshToken` lưu trong cookie với các thuộc tính:
  - `httpOnly: true` (JavaScript hoàn toàn không thể đọc hoặc can thiệp).
  - `sameSite: 'strict'` (Chống tấn công Cross-Site Request Forgery - CSRF).
  - `secure: true` trong môi trường production (chỉ truyền tải qua kết nối HTTPS).
  - `path: '/'`

### 3. Cơ Chế Khôi Phục Phiên Đăng Nhập (Session Restoration Flow)
- Khi người dùng tải lại trang (F5) hoặc mở một tab mới:
  1. Trạng thái xác thực ban đầu là `isLoading = true`.
  2. Giao diện hiển thị màn hình chờ khôi phục phiên (`Đang khôi phục phiên làm việc...`), **tuyệt đối không chuyển hướng về `/login` ngay lập tức**.
  3. `AuthProvider` gửi một yêu cầu nền `POST /auth/refresh` với tùy chọn `credentials: 'include'`. Trình duyệt sẽ tự động đính kèm cookie `refreshToken`.
  4. Nếu máy chủ phản hồi thành công với `accessToken` mới:
     - Lưu `accessToken` vào biến bộ nhớ.
     - Gọi tiếp `GET /auth/me` để nạp thông tin người dùng (`User` profile, vai trò `role`, thông tin công ty `company`).
     - Đặt `isLoading = false` và hiển thị nội dung giao diện được phân quyền.
  5. Nếu `POST /auth/refresh` thất bại (do cookie không tồn tại, phiên bị thu hồi hoặc đã hết hạn):
     - Đặt `isLoading = false`, `user = null`, `accessToken = null`.
     - Layout thực hiện chuyển hướng về trang `/login`.

### 4. Tự Động Xoay Vòng và Làm Mới Token (Transparent 401 Interceptor)
- Trong quá trình sử dụng, khi `accessToken` (thời hạn 15 phút) hết hạn, các API nghiệp vụ sẽ phản hồi mã `401 Unauthorized`.
- Hàm `fetchApi` trong `api-client.ts` tự động phát hiện mã 401, tạm dừng request hiện tại, thực hiện gọi `POST /auth/refresh` để xin cấp một `accessToken` mới trong bộ nhớ, sau đó tự động retry lại request ban đầu với header `Authorization: Bearer <newToken>`.
- Toàn bộ quá trình này diễn ra hoàn toàn trong suốt với người dùng, không gây gián đoạn luồng thao tác.

## Consequences & Trade-offs

### Ưu Điểm
- **Miễn nhiễm với tấn công đánh cắp Token qua XSS:** Dù kẻ tấn công có khai thác được lỗ hổng XSS trên trang, chúng không thể đọc được `refreshToken` (nằm trong httpOnly cookie) và không thể lấy cắp `accessToken` từ `localStorage`/`sessionStorage`.
- **Tuân thủ chuẩn OAuth 2.0 Security BCP:** Đáp ứng nghiêm ngặt khuyến nghị *OAuth 2.0 Security Best Current Practice* của IETF dành cho các ứng dụng dựa trên trình duyệt.
- **Duy trì trải nghiệm mượt mà:** Khôi phục phiên tự động và xoay vòng token trong suốt khi người dùng thao tác liên tục.

### Đánh Đổi & Thách Thức
- Khi người dùng F5 hoặc mở tab mới, ứng dụng cần một khoảng thời gian nhỏ (vài chục mili-giây) để hoàn tất vòng gọi mạng `POST /auth/refresh` trước khi render dữ liệu. Điều này được giải quyết bằng một màn hình loading tối giản, tránh hiện tượng chớp nháy giao diện (FOUC).
