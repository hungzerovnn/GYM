# 05 - Cách lấy connection string

## Trong Neon Console
1. Vào project Neon của bạn.
2. Vào tab **Connect**.
3. Chọn driver PostgreSQL.
4. Chép dòng `Connection string`.
5. Đảm bảo bao gồm `?sslmode=require`.

## Đặt vào local
- `publish/api-worker/.dev.vars`:
  - `NEON_DATABASE_URL=postgresql://...`

## Đặt vào production
- Trong worker:
```bash
cd publish/api-worker
npx wrangler secret put NEON_DATABASE_URL
```
Nhập đúng chuỗi khi shell hỏi.

## Lưu ý
- Không đưa chuỗi thật vào git.
- Mỗi môi trường (local/prod) nên có chuỗi riêng nếu có policy phân tách.
