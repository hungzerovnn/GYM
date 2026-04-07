# 03 - Cach tao Worker

Bo nay co 2 lop Worker:
- Frontend Worker cho `apps/web`
- API Worker trong `publish/api-worker`

## Frontend Worker
```bash
cd C:\xampp\htdocs\GYM\publish\web
npm run deploy:worker
```

Truoc khi deploy, dien `NEXT_PUBLIC_API_URL` vao `publish/web/.env`.

## API Worker
```bash
cd C:\xampp\htdocs\GYM\publish\api-worker
npm install
npx wrangler login
npx wrangler secret put NEON_DATABASE_URL
npx wrangler deploy
```
