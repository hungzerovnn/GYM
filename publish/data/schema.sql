-- Đây là lớp schema nền cho môi trường deploy mới.
-- Các table thực tế được tạo từ các migration trong publish/data/migrations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Không tạo override lên DB đang chạy.
-- Khi import cho Neon mới, chạy theo thứ tự:
-- 1) schema.sql
-- 2) migration.sql từ publish/data/migrations/<timestamp>
-- 3) seed.sql
