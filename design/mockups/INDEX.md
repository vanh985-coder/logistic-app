# Mockup Logix-3D — phân loại theo MÔ HÌNH VẬN HÀNH APP

Nguồn: `MÔ-HÌNH-VẬN-HÀNH-APP.docx` (9 bước nghiệp vụ).

Mỗi thư mục = 1 bước trong tài liệu.
- `00-tong-quan-*.png` — ảnh tổng hợp (sheet nhiều màn) trích từ file .docx của bước đó.
- Các file đánh số `01-…`, `02-…` — từng màn riêng lẻ, độ phân giải đầy đủ, xếp theo đúng thứ tự luồng.

| Bước | Thư mục | Sheet tổng quan | Màn lẻ |
|---|---|---|---|
| 1 | `01-dang-ky-tai-khoan-chu-hang` | ✔ | 8 |
| 2 | `02-dang-ky-tai-khoan-fwd-cfs` | ✔ | 6 (FWD) + 6 (CFS) |
| 3 | `03-dang-hang` | ✔ | — |
| 4 | `04-ghep-noi-va-goi-y-sap-xep` | ✔ | 9 |
| 5 | `05-goi-y-chi-phi-va-fwd-phu-hop` | ✔ | — |
| 6 | `06-thong-tin-fwd-hien-thi` | ✔ | 2 |
| 7 | `07-ban-giao-hang-tai-kho-cfs` | ✔ | — |
| 8 | `08-gom-hang-va-dong-container` | ✔ | — |
| 9 | `09-trang-thai-van-chuyen-va-danh-gia` | ✔ | — |

## Quy ước đặt tên
`<số thứ tự luồng>-<tên màn không dấu, kebab-case>.<ext>`
Ví dụ: `04-ghep-noi-va-goi-y-sap-xep/05-xem-xep-hang-3d.png`

## Chưa có màn lẻ
Bước 3, 5, 7, 8, 9 hiện chỉ có sheet tổng quan từ .docx. Khi xuất được ảnh
từng màn, đặt vào đúng thư mục theo quy ước trên.
