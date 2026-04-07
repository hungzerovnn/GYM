# publish/data

Thư mục này chỉ dùng cho deploy và tạo DB mới trên Neon (không đụng DB đang chạy hiện tại).

## Cấu trúc
- `schema.sql`: extension + tiền đề cho schema mới.
- `migrations/`: copy toàn bộ migration hiện có từ `prisma/migrations`.
- `seed.sql`: seed mẫu tối thiểu.
- `seeds/`: tài liệu seed mẫu/định dạng tương lai.
- `samples/`: file ví dụ dữ liệu dùng cho kiểm thử.
- `import-to-neon.mjs`: script import toàn bộ SQL theo thứ tự.

## Chạy import
```bash
cd C:\xampp\htdocs\GYM
$env:NEON_DATABASE_URL = "postgresql://...."
node publish/data/import-to-neon.mjs
```

Neu da co `publish/api-worker/.dev.vars` thi script import se uu tien doc `NEON_DATABASE_URL` tu file nay, ban khong can export lai bien moi truong.

## Ghi chú an toàn
- Đây là DB mới, bạn không dùng connection string của DB production cũ.
- Script có thể chạy nhiều lần nếu migration `CREATE IF NOT EXISTS` và seed `ON CONFLICT DO NOTHING`.
