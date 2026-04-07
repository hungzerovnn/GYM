# 04 - Cách tạo Neon Database

## Bước 1: Tạo project
1. Truy cập Neon Console.
2. Create project mới (đặt tên ví dụ `fitflow-deploy`).
3. Tạo PostgreSQL database mới (ví dụ `fitness_management_staging`).
4. Không dùng database đang chạy của môi trường cũ.

## Bước 2: Tạo user / role (nếu cần)
- Nếu tài khoản mặc định đã đủ quyền thì có thể dùng luôn.
- Nếu muốn role riêng:
  - Tạo user riêng cho app worker.
  - Phân quyền `CONNECT`, `USAGE`, `SELECT`, `INSERT`, `UPDATE`, `DELETE` theo nhu cầu.

## Bước 3: Copy connection string
- Vào `Connect` -> sao chép connection string dạng:
  `postgresql://username:password@host:5432/dbname?sslmode=require`
- Dùng chuỗi này cho:
  - Local: `publish/api-worker/.dev.vars`
  - Production: Secret `NEON_DATABASE_URL`
