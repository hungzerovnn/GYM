# 07 - Cach deploy (thu tu chuan)

## Buoc 1: Day code len GitHub
- Push source len GitHub repository.
- Dung branch `main`.

## Buoc 2: Tao GitHub Secrets
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

## Buoc 3: Tao GitHub Variables
- `CLOUDFLARE_PAGES_PROJECT_NAME=gymvnchoice`
- `FRONTEND_UPSTREAM_URL=https://gymvnchoice-web.hungzerovnn.workers.dev`
- `NEXT_PUBLIC_API_URL=https://fitflow-api-worker.hungzerovnn.workers.dev/api`

## Buoc 4: Tao backend Railway
- Ket noi Railway voi GitHub repo.
- De Railway doc `railway.json`.
- Neu can, them bien:
  - `RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile.railway`

## Buoc 5: Nhap bien moi truong backend tren Railway
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL`
- `JWT_REFRESH_TTL`
- `LICENSE_ACTIVATION_PASSWORD`
- `APP_URL=https://gymvnchoice.pages.dev`
- `CORS_ALLOWED_ORIGINS=https://gymvnchoice.pages.dev,https://gymvnchoice-web.hungzerovnn.workers.dev,https://fitflow-api-worker.hungzerovnn.workers.dev`
- `TENANT_APP_URL_DEFAULT=https://gymvnchoice.pages.dev`

## Buoc 6: Lay backend Railway URL va noi vao API Worker
Sua `publish/api-worker/wrangler.jsonc`:
```json
"BACKEND_API_URL": "https://<your-railway-backend>.up.railway.app"
```

Deploy lai API worker:
```bash
cd C:\xampp\htdocs\GYM
npm run deploy:worker
```

## Buoc 7: Deploy frontend tren Ubuntu
- Push mot commit moi len `main`
- Hoac chay tay workflow:
  - `Deploy Frontend to Cloudflare`

## Buoc 8: Seed DB Neon moi neu chua lam
```bash
cd C:\xampp\htdocs\GYM
npm run db:seed
```

## Buoc 9: Verify
- `https://gymvnchoice.pages.dev`
- `https://gymvnchoice-web.hungzerovnn.workers.dev`
- `GET https://fitflow-api-worker.hungzerovnn.workers.dev/api/health`
- `GET https://<your-railway-backend>.up.railway.app/api/health`
- `GET https://fitflow-api-worker.hungzerovnn.workers.dev/api/db-check`
