# README_WORKER_VI.md

Worker này dùng khi backend NestJS vẫn chạy ở dịch vụ cũ và chưa migrate 100% lên Worker.

## 1) Mục tiêu
- Publish API layer trên Cloudflare.
- Có các route chuẩn:
  - `GET /api/health`
  - `GET /api/db-check`
  - `GET /api/config`
- Proxy các route còn lại về backend cũ (`BACKEND_API_URL`).

## 2) Local
1. Tạo file:
   - `publish/api-worker/.dev.vars`
2. Điền:
   - `NEON_DATABASE_URL=...`
   - `APP_ENV=development`
   - `BACKEND_API_URL=http://localhost:6273`
   - `FRONTEND_ORIGINS=http://localhost:6173,https://gymvnchoice.pages.dev`
3. Chạy:
   ```bash
   cd publish/api-worker
   npm install
   npm run dev
   ```

## 3) Production
1. Trong thư mục `publish/api-worker`:
   ```bash
   npx wrangler login
   npx wrangler secret put NEON_DATABASE_URL
   ```
2. Deploy:
   ```bash
   npx wrangler deploy
   ```

## 4) Env/secret
- `NEON_DATABASE_URL` = bắt buộc, lưu bằng secret.
- `BACKEND_API_URL` = URL API cũ (NestJS đang chạy).
- `FRONTEND_ORIGINS` hoặc `CORS_ALLOWED_ORIGINS` = origin Pages để CORS.
  Ví dụ production hiện tại: `https://gymvnchoice.pages.dev`
- `APP_ENV`: `development`/`production`.

## 5) Lý do tại sao cần adapter/proxy
Backend hiện tại là NestJS + multi tenant + Prisma lifecycle sâu.
Di chuyển toàn bộ backend vào Worker ngay lập tức sẽ có rủi ro lớn.
Worker hiện tại chỉ đảm nhiệm:
- lớp kết nối DB Neon qua `/api/db-check`
- route `health/config`
- chuyển tiếp (proxy) request API sang backend cũ.
