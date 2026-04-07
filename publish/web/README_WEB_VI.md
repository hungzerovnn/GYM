# README WEB - Frontend deploy (publish/web)

## 1) Ket luan sau khi kiem tra lai codebase
- Frontend hien tai la Next.js App Router co route dong va co su dung `next/headers`.
- Vi vay khong nen deploy nhu static HTML export tren Pages.
- Cach an toan de giu nguyen app hien tai la:
  - deploy frontend that len Cloudflare Workers
  - dung Pages lam lop proxy de giu domain `gymvnchoice.pages.dev`

## 2) File nao can dien
- `publish/web/.env`
- Bien quan trong:
  - `CLOUDFLARE_PAGES_PROJECT_NAME=gymvnchoice`
  - `FRONTEND_UPSTREAM_URL=https://<frontend-worker>.workers.dev`
  - `NEXT_PUBLIC_API_URL=https://<api-worker>.workers.dev/api`

## 3) Deploy frontend that len Workers
```bash
cd publish/web
npm run deploy:worker
```

Script nay se build `apps/web` bang OpenNext va deploy len Cloudflare Workers.

## 4) Deploy Pages proxy
```bash
cd publish/web
npm run build
npm run deploy
```

Script `build` tao `dist/_worker.js` de proxy moi request tu `gymvnchoice.pages.dev` sang frontend Worker that.

## 5) Ve phan giu nguyen code cu
- Khong tao frontend moi.
- Khong sua giao dien, module, tab, badge, layout.
- Khong doi logic nghiep vu.
- Chi bo sung wrapper deploy va lop Pages proxy.
