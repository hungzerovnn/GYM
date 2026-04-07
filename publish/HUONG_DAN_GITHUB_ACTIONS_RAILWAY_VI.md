# HUONG DAN GITHUB ACTIONS UBUNTU + RAILWAY + CLOUDFLARE

Tai lieu nay dung cho mo hinh on dinh hon, khong phu thuoc laptop ca nhan bat 24/24.

## 1. Muc tieu
- Frontend duoc build tren `ubuntu-latest` cua GitHub Actions.
- Frontend duoc deploy len Cloudflare Workers va Pages.
- Backend NestJS duoc host tren Railway.
- Database duoc dat tren Neon.
- Khong dung Cloudflare Tunnel tu laptop de chay production.

## 2. Kien truc sau cung
```text
GitHub repo
  -> GitHub Actions (Ubuntu)
  -> Cloudflare Frontend Worker (gymvnchoice-web)
  -> Cloudflare Pages (gymvnchoice.pages.dev)
  -> Cloudflare API Worker (fitflow-api-worker)
  -> Railway Backend NestJS
  -> Neon PostgreSQL moi
```

## 3. File da duoc tao san trong repo
- `.github/workflows/deploy-frontend-cloudflare.yml`
- `apps/api/Dockerfile.railway`
- `railway.json`
- `apps/api/src/health.controller.ts`
- `publish/GITHUB_RAILWAY_CLOUDFLARE_COPY_PASTE_VI.md`
- `publish/railway.env.example`
- `publish/github-actions.variables.example`

## 4. Buoc 1 - Day source code len GitHub
1. Tao mot repository moi tren GitHub.
2. Push toan bo source code hien tai len repository do.
3. Dam bao branch chinh la `main`.

## 5. Buoc 2 - Chuan bi Cloudflare de GitHub Actions deploy
Cloudflare Docs ghi ro trong CI/CD can dung:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

### Tao API token
1. Dang nhap Cloudflare dashboard.
2. Vao trang API Tokens.
3. Tao token moi tu template Worker/Edit Cloudflare Workers.
4. Chi cap quyen dung account can deploy.
5. Copy token ra cho buoc GitHub Secrets.

### Lay Account ID
1. Vao Cloudflare dashboard.
2. Mo account dang su dung cho `gymvnchoice`.
3. Copy `Account ID`.

## 6. Buoc 3 - Nhap GitHub Secrets va GitHub Variables
Vao repository GitHub:
`Settings` -> `Secrets and variables` -> `Actions`

### Tao Secrets
1. `CLOUDFLARE_ACCOUNT_ID`
2. `CLOUDFLARE_API_TOKEN`

### Tao Variables
1. `CLOUDFLARE_PAGES_PROJECT_NAME`
   - Gia tri: `gymvnchoice`
2. `FRONTEND_UPSTREAM_URL`
   - Gia tri mau: `https://gymvnchoice-web.hungzerovnn.workers.dev`
   - Sau nay neu doi ten worker thi cap nhat lai bien nay.
3. `NEXT_PUBLIC_API_URL`
   - Gia tri mau: `https://fitflow-api-worker.hungzerovnn.workers.dev/api`
   - Day la URL frontend dung de goi API worker.

## 7. Buoc 4 - Workflow frontend hoat dong nhu the nao
Workflow da tao san tai:
`/.github/workflows/deploy-frontend-cloudflare.yml`

Khi ban push len branch `main`, workflow se:
1. Chay tren `ubuntu-latest`
2. Cai dependency cua `apps/web`
3. Tao file `publish/web/.env` tam trong runner CI
4. Deploy frontend that len Cloudflare Workers
5. Deploy lop Pages proxy len Cloudflare Pages

## 8. Buoc 5 - Tao backend Railway
### Tao project va service
1. Dang nhap Railway.
2. Tao `New Project`.
3. Chon `Deploy from GitHub repo`.
4. Chon repository vua push o buoc 1.

### File config da tao san
- `railway.json`
- `apps/api/Dockerfile.railway`

`railway.json` dang cau hinh:
- builder: `DOCKERFILE`
- dockerfile path: `apps/api/Dockerfile.railway`
- healthcheck: `/api/health`

### Neu Railway khong tu nhan Dockerfile path
Vao `Service Variables` va them:
`RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile.railway`

## 9. Buoc 6 - Nhap bien moi truong cho Railway
Trong service backend tren Railway, them cac bien toi thieu sau:

1. `DATABASE_URL`
   - Dan connection string cua Neon moi
2. `JWT_ACCESS_SECRET`
3. `JWT_REFRESH_SECRET`
4. `JWT_ACCESS_TTL`
   - Vi du: `15m`
5. `JWT_REFRESH_TTL`
   - Vi du: `7d`
6. `LICENSE_ACTIVATION_PASSWORD`
7. `APP_URL`
   - Gia tri de nghi: `https://gymvnchoice.pages.dev`
8. `CORS_ALLOWED_ORIGINS`
   - Gia tri de nghi:
   - `https://gymvnchoice.pages.dev,https://gymvnchoice-web.hungzerovnn.workers.dev,https://fitflow-api-worker.hungzerovnn.workers.dev`
9. `TENANT_APP_URL_DEFAULT`
   - Gia tri de nghi: `https://gymvnchoice.pages.dev`

Luu y:
- `PORT` thuong duoc Railway tu inject, khong can hard-code neu Railway da cap.
- Neu service bao loi do thieu bien moi truong, doi chieu them voi file `.env.example` cua repo.

## 10. Buoc 7 - Lay domain backend Railway
Sau khi Railway build xong:
1. Vao service backend.
2. Mo tab domain/networking.
3. Copy domain public, vi du:
   - `https://gymvnchoice-api-production.up.railway.app`

## 11. Buoc 8 - Noi API Worker sang Railway backend
Mo file:
`publish/api-worker/wrangler.jsonc`

Sua gia tri:
```json
"BACKEND_API_URL": "https://gymvnchoice-api-production.up.railway.app"
```

Sau do deploy lai API worker:
```bash
cd C:\xampp\htdocs\GYM\publish\api-worker
npx wrangler deploy
```

Neu muon local van chay duoc, giu file:
`publish/api-worker/.dev.vars`
voi:
```env
BACKEND_API_URL=http://localhost:6273
```

## 12. Buoc 9 - Kich hoat frontend deploy tu GitHub Actions
Sau khi GitHub Secrets/Variables da du:
1. Push mot commit moi len `main`
2. Hoac vao tab `Actions`
3. Chay tay workflow `Deploy Frontend to Cloudflare`

## 13. Buoc 10 - Cach test sau khi lam xong
### Test backend Railway
Mo:
`https://<railway-domain>/api/health`

Ket qua mong doi:
```json
{
  "ok": true,
  "service": "fitflow-api",
  "timestamp": "..."
}
```

### Test API Worker
Mo:
`https://fitflow-api-worker.hungzerovnn.workers.dev/api/health`

### Test frontend Worker
Mo:
`https://gymvnchoice-web.hungzerovnn.workers.dev`

### Test Pages domain chinh
Mo:
`https://gymvnchoice.pages.dev`

## 14. Thu tu deploy de nghi
1. Deploy backend Railway truoc
2. Sua `BACKEND_API_URL` trong `publish/api-worker/wrangler.jsonc`
3. Deploy lai API Worker
4. Push code len GitHub de GitHub Actions deploy frontend tren Ubuntu
5. Mo `gymvnchoice.pages.dev` de kiem tra

## 15. Tai sao cach nay ben hon Cloudflare Tunnel
- Khong phu thuoc laptop bat lien tuc
- Khong phu thuoc quick tunnel URL thay doi
- Frontend build trong Ubuntu, phu hop hon voi OpenNext Cloudflare
- Backend NestJS chay tren service luon bat

## 16. Neu can rollback
### Frontend
1. Vao GitHub Actions
2. Chon commit truoc do
3. Re-run workflow cua commit on dinh

### Backend Railway
1. Vao Railway deployment history
2. Chon deployment on dinh truoc do
3. Redeploy lai deployment do

## 17. Nho quan trong
- Frontend hien tai khong nen build production tu Windows de day len Cloudflare Workers.
- Backend production khong nen dung laptop + Cloudflare Tunnel.
- Neon phai la database moi, khong de vao database cu dang chay.
