# 01 - Tong quan he thong publish

## Kien truc sau khi sua
```text
Nguoi dung
  -> Cloudflare Pages (gymvnchoice.pages.dev, proxy layer)
  -> Frontend Worker (Next.js that, build tu GitHub Actions Ubuntu)
  -> API Worker (/api/health, /api/db-check, /api/config, proxy API cu)
  -> Railway Backend NestJS
  -> Neon PostgreSQL moi
```

## Vi sao khong dung laptop + tunnel lam production
- Laptop khong phai luc nao cung bat.
- Cloudflare quick tunnel co the doi URL.
- Backend production can mot noi luon bat nhu Railway.

## Vi sao frontend nen build bang Ubuntu
- Codebase hien tai dung Next.js App Router.
- Co su dung `next/headers` va route dong.
- Build OpenNext tren Windows da gap loi runtime.
- Ubuntu/GitHub Actions la huong an toan hon cho frontend nay.

## Nguyen tac van giu
- Khong doi UI.
- Khong doi module.
- Khong doi tab/menu/badge/icon/layout.
- Chi them lop deploy va proxy.
