# 02 - Cach tao Cloudflare Pages

Trang `gymvnchoice.pages.dev` trong bo nay duoc dung lam Pages proxy, khong phai noi build frontend Next.js that.

## Tao Pages project
```bash
cd C:\xampp\htdocs\GYM
npx wrangler login
npx wrangler pages project create gymvnchoice
```

## Cau hinh proxy
Mo `publish/web/.env` va dien:
```env
CLOUDFLARE_PAGES_PROJECT_NAME=gymvnchoice
FRONTEND_UPSTREAM_URL=https://<frontend-worker>.workers.dev
```

## Build Pages proxy
```bash
cd publish/web
npm run build
```

## Deploy Pages proxy
```bash
cd publish/web
npm run deploy
```

## Kiem tra
- Mo `https://gymvnchoice.pages.dev`
- Kiem tra request duoc forward sang frontend worker that
