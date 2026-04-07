# 06 - Cách nhập connection string

## 1) Local (`.dev.vars`)
Mở file:
`publish/api-worker/.dev.vars`

Nội dung bắt buộc:
```env
NEON_DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
APP_ENV=development
```

## 2) Production (Cloudflare Secret)
```bash
cd C:\xampp\htdocs\GYM\publish\api-worker
npx wrangler secret put NEON_DATABASE_URL
```
Paste connection string vào terminal khi prompt.

## 3) Kiểm tra
- Chạy local: `npm run dev` tại `publish/api-worker` rồi gọi:
  - `http://127.0.0.1:8787/api/db-check`
