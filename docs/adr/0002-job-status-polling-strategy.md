# ADR 0002: Packing Job Status Polling vs. Server-Sent Events (SSE)

## Context
Thuật toán 3D Bin Packing là tác vụ tính toán chiếm dụng CPU cao (CPU-bound) với budget tối đa 8 giây. Tác vụ này được xử lý bất đồng bộ bởi tiến trình worker độc lập (`apps/worker`) thông qua BullMQ. Khi client (web frontend) yêu cầu tính toán, API trả về mã phản hồi `202 Accepted` kèm `jobId`. Client cần theo dõi trạng thái và lấy kết quả tính toán khi hoàn tất.

Hai phương án được xem xét:
1. **Server-Sent Events (SSE):** API mở kết nối stream HTTP một chiều tới client và bắn sự kiện khi worker hoàn thành.
2. **Short Polling có Backoff:** Client gọi `GET /packing-jobs/:id` theo chu kỳ định kỳ (1s trong 10 giây đầu, tăng lên 2s sau 10 giây).

## Decision
Quyết định **sử dụng Polling có Backoff (`GET /packing-jobs/:id`)**, không sử dụng SSE cho phiên bản hiện tại.

**Lý do:**
1. **Kiến trúc phân tán & Scale ngang:**
   - Worker chạy trên tiến trình riêng biệt và có thể scale độc lập với API.
   - Khi API scale ngang thành nhiều replicas (ví dụ 3-5 instances đằng sau Load Balancer), một kết nối SSE mở tới replica A sẽ không tự động nhận được sự kiện khi worker hoàn tất trừ khi phải thiết lập thêm một tầng trung gian **Redis Pub/Sub** để broadcast event giữa các API replicas.
   - Điều này làm tăng độ phức tạp vận hành, tiềm ẩn nguy cơ mất gói tin (leak connection) và overhead duy trì long-lived HTTP connections trên gateway.
2. **Stateless API & Hiệu quả Cache:**
   - Kết quả packing và trạng thái job được lưu trực tiếp trong Redis.
   - Bất kỳ API replica nào cũng có thể đọc trực tiếp từ Redis trong thời gian $\le 2\text{ms}$ mà không phụ thuộc vào trạng thái kết nối socket hay instance nào đang giữ client.
3. **Chi phí mạng không đáng kể:**
   - Thời gian xử lý trung bình của job packing từ 2–8 giây, tương đương chỉ 3–8 requests polling dạng lightweight JSON.
   - Sử dụng chu kỳ: 1s trong 10 giây đầu, sau đó giãn cách (exponential backoff) lên 2s nếu job kéo dài.

## Consequences
- **Ưu điểm:**
  - API hoàn toàn stateless, dễ dàng scale ngang bằng cách tăng container replica.
  - Không cần duy trì Redis Pub/Sub phức tạp hoặc lo lắng về việc đứt gãy kết nối SSE khi đi qua các proxy / NAT / corporate firewalls.
  - Phục vụ hoàn hảo cả môi trường web và mobile.
- **Nhược điểm:**
  - Độ trễ tối đa giữa lúc worker xong và client nhận được kết quả là 1 giây (hoàn toàn chấp nhận được đối với tác vụ logistics).
