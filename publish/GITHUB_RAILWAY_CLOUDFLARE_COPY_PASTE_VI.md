# GITHUB + RAILWAY + CLOUDFLARE - BO COPY PASTE NHANH

File nay duoc tao de ban co the copy-paste nhanh khi cau hinh GitHub Actions, Railway va Cloudflare.

## 1. GitHub Secrets can tao
Vao GitHub repository:
`Settings` -> `Secrets and variables` -> `Actions` -> `Secrets`

Tao 2 secret sau:

### Secret 1
Name:
```text
CLOUDFLARE_ACCOUNT_ID
```
Value:
```text
<dan-account-id-cloudflare-cua-ban-vao-day>
```

### Secret 2
Name:
```text
CLOUDFLARE_API_TOKEN
```
Value:
```text
<dan-api-token-cloudflare-cua-ban-vao-day>
```

## 2. GitHub Variables can tao
Vao GitHub repository:
`Settings` -> `Secrets and variables` -> `Actions` -> `Variables`

### Variable 1
Name:
```text
CLOUDFLARE_PAGES_PROJECT_NAME
```
Value:
```text
gymvnchoice
```

### Variable 2
Name:
```text
FRONTEND_UPSTREAM_URL
```
Value:
```text
https://gymvnchoice-web.hungzerovnn.workers.dev
```

### Variable 3
Name:
```text
NEXT_PUBLIC_API_URL
```
Value:
```text
https://fitflow-api-worker.hungzerovnn.workers.dev/api
```

## 3. Railway Variables can tao
Vao Railway project -> service backend -> `Variables`

Copy tung dong duoi day vao Railway:

```text
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>?sslmode=require
JWT_ACCESS_SECRET=<tu-dat-mot-secret-dai-kho-doan>
JWT_REFRESH_SECRET=<tu-dat-mot-secret-dai-kho-doan-khac>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
LICENSE_ACTIVATION_PASSWORD=258258
APP_URL=https://gymvnchoice.pages.dev
CORS_ALLOWED_ORIGINS=https://gymvnchoice.pages.dev,https://gymvnchoice-web.hungzerovnn.workers.dev,https://fitflow-api-worker.hungzerovnn.workers.dev
TENANT_APP_URL_DEFAULT=https://gymvnchoice.pages.dev
```

Neu Railway can them Dockerfile path, them bien nay:
```text
RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile.railway
```

## 4. Railway domain sau khi deploy
Sau khi Railway build xong, ban se co 1 domain backend, vi du:

```text
https://gymvnchoice-api-production.up.railway.app
```

Luu domain nay de noi vao Cloudflare API Worker.

## 5. Gia tri can sua trong Cloudflare API Worker
Mo file:
`publish/api-worker/wrangler.jsonc`

Sua dong:

```json
"BACKEND_API_URL": "https://<your-railway-backend>.up.railway.app"
```

Thanh domain Railway that cua ban, vi du:

```json
"BACKEND_API_URL": "https://gymvnchoice-api-production.up.railway.app"
```

## 6. Lenh deploy lai API Worker sau khi co Railway URL
```bash
cd C:\xampp\htdocs\GYM
npm run deploy:worker
```

## 7. Lenh seed Neon moi
Neu chua seed:

```bash
cd C:\xampp\htdocs\GYM
npm run db:seed
```

## 8. Cach deploy frontend bang GitHub Actions
Sau khi da tao xong GitHub Secrets/Variables:
1. Push code len branch `main`
2. Vao tab `Actions`
3. Chay workflow:
   `Deploy Frontend to Cloudflare`

## 9. Cac URL can test sau cung
### Backend Railway
```text
https://<your-railway-backend>.up.railway.app/api/health
```

### API Worker
```text
https://fitflow-api-worker.hungzerovnn.workers.dev/api/health
```

### Frontend Worker
```text
https://gymvnchoice-web.hungzerovnn.workers.dev
```

### Pages domain chinh
```text
https://gymvnchoice.pages.dev
```

## 10. Thu tu thao tac nhanh nhat
1. Tao GitHub Secrets
2. Tao GitHub Variables
3. Tao Railway service
4. Nhap Railway Variables
5. Lay Railway URL
6. Sua `publish/api-worker/wrangler.jsonc`
7. Chay `npm run deploy:worker`
8. Push code len GitHub de frontend deploy tren Ubuntu
9. Test lai tat ca URL
