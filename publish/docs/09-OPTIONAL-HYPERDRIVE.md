# 09 - Tùy chọn Hyperdrive (tuỳ chọn)

Nếu DB Neon nằm xa so với Cloudflare, có thể cân nhắc Cloudflare Hyperdrive cho latency thấp hơn.

## Lưu ý
- Hyperdrive giúp tối ưu kết nối.
- Không bắt buộc để deploy cơ bản.
- Nếu bật Hyperdrive, vẫn giữ nguyên nguyên tắc:
  - không chỉnh DB đang chạy cũ
  - chỉ thay đổi string kết nối ở env và secret phù hợp.

## Bước kỹ thuật nhanh
1. Tạo Hyperdrive endpoint trên Cloudflare.
2. Thay `NEON_DATABASE_URL` bằng DSN mới phù hợp môi trường Worker.
3. Đẩy secret lại bằng `wrangler secret put`.
