# GUIDE TRIEN KHAI - Publish / Deploy

Muc tieu cua lop `publish/` la giu nguyen he thong FitFlow dang chay, chi bo sung lop deploy, proxy, script va tai lieu.

## 1) Mo hinh deploy hien tai duoc khuyen nghi
- Frontend Next.js build tren GitHub Actions `ubuntu-latest`
- Frontend that deploy len Cloudflare Workers
- `gymvnchoice.pages.dev` giu vai tro Pages proxy/public domain
- API adapter deploy len Cloudflare Worker rieng
- Backend NestJS deploy len Railway
- Database deploy tren Neon moi

## 2) Vi sao doi mo hinh
- Frontend hien tai la Next.js App Router dong, khong phu hop static Pages thuan.
- Build frontend tren Windows co the gay loi runtime khi len OpenNext/Cloudflare.
- Backend NestJS khong nen chay production qua Cloudflare Tunnel tu laptop.

## 3) File huong dan nen doc truoc
- File tong hop moi:
  - `publish/HUONG_DAN_GITHUB_ACTIONS_RAILWAY_VI.md`
- File tong quan:
  - `publish/docs/01-TONG-QUAN.md`
- File trinh tu deploy:
  - `publish/docs/07-CACH-DEPLOY.md`

## 4) File moi da them cho mo hinh on dinh
- `/.github/workflows/deploy-frontend-cloudflare.yml`
- `/apps/api/Dockerfile.railway`
- `/railway.json`
- `/apps/api/src/health.controller.ts`

## 5) Thu tu khuyen nghi
1. Tao backend Railway truoc
2. Noi backend Railway vao API Worker
3. Push code len GitHub de workflow Ubuntu deploy frontend
4. Verify lai `gymvnchoice.pages.dev`

## 6) Ghi chu quan trong
- Muc tieu cao nhat van la giu nguyen UI/module/logic dang chay.
- Frontend khong nen build production tren Windows cho Cloudflare Workers.
- Backend production khong nen dung quick tunnel tu laptop.
