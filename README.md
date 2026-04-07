# FitFlow Enterprise

FitFlow Enterprise la he thong quan ly phong gym / fitness center da chi nhanh theo kien truc Next.js + NestJS + Prisma + PostgreSQL.

## Thanh phan chinh
- `apps/web`: cong admin portal.
- `apps/api`: backend NestJS REST API.
- `prisma`: schema, migration, seed.
- `docs`: business flow, ERD va API spec.
- `docker-compose.yml`: postgres, redis, minio, api, web.

## Cai dat nhanh
1. Sao chep `.env.example` thanh `.env` va dieu chinh bien moi truong neu can.
2. Chay ha tang: `docker compose up -d postgres redis minio`
3. Chay migration va seed:
   - `npm run db:generate`
   - `npm run db:migrate`
   - `npm run db:seed`
4. Chay backend: `npm run dev:api`
5. Chay frontend: `npm run dev:web`
6. Frontend duoc co dinh o cong `6173`

## Chay nhanh bang 1 click
- Nhay vao `start.bat` de:
- Khoi tao / bat local PostgreSQL dev trong thu muc `.runtime/postgres` neu may chua co Docker.
- Tu dong migrate database.
- Seed du lieu mau khi database con trong.
- Bat API va Web trong 2 cua so rieng.

## Tai khoan demo seed
- Super Admin: `admin@fitflow.local` / `Admin@123`
- Branch Manager: `manager@fitflow.local` / `Admin@123`
- Sales: `sales@fitflow.local` / `Admin@123`
- Trainer: `trainer@fitflow.local` / `Admin@123`

## Tinh nang noi bat
- JWT access + refresh token.
- OTP dang nhap 2 buoc qua Zalo ZNS, co request OTP, cooldown, het han, gioi han so lan sai va audit log.
- RBAC theo role, permission va branch scope.
- Dashboard va report truy van so lieu that.
- CRUD day du cho customer, lead, contract, receipt, expense, locker, deposit, product, supplier, purchase order.
- Audit log cho login, export va bien dong du lieu.
- Seed demo da chi nhanh de chay local nhanh.

## Cau hinh OTP Zalo
1. Dang nhap bang tai khoan admin.
2. Vao `He thong > Zalo`.
3. Cau hinh toi thieu:
   - `Bat kenh Zalo`
   - `Token`
   - `OTP Template ID`
   - `Bien OTP` thuong la `otp`
4. Neu muon test tren mot so co dinh, dien `So test override`.
5. Chi khi cau hinh hop le thi moi bat `Bat OTP login`.

### Luu y de gui OTP that
- Zalo OTP o day dung co che ZNS, khong the gui chi bang moi so dien thoai.
- Ban can OA/ZCA/App ID da duoc lien ket, Access Token hop le va template ZNS da duyet.
- Tai lieu chinh thuc Zalo:
  - https://zalo.solutions/blog/gui-api/rrzepi6v8x0yrrlhnvlbogkh
  - https://zalo.solutions/blog/huong-dan-dang-ky-su-dung-dich-vu-zns/jlm44tzzwffh0od10ix6rra7
