# 08 - Cach test sau deploy

## 1) Test frontend
- Mo `https://gymvnchoice.pages.dev`
- Dang nhap theo flow cu
- So sanh menu, badge, icon, tab, form, bang, layout

## 2) Test frontend worker truc tiep
- Mo `https://<frontend-worker>.workers.dev`
- Kiem tra UI giong Pages

## 3) Test API worker
- `GET /api/health`
- `GET /api/config`
- `GET /api/db-check`

Neu thieu secret, `/api/db-check` phai tra loi ro rang rang `NEON_DATABASE_URL is missing`.

## 4) Test Pages proxy
- Mo DevTools Network
- Kiem tra request tai `gymvnchoice.pages.dev` van tra response tu frontend worker

## 5) Test DB seed
```bash
cd C:\xampp\htdocs\GYM
npm run db:seed
```
