-- Chạy 1 lần khi container khởi tạo volume lần đầu (docker-entrypoint-initdb.d),
-- dưới quyền POSTGRES_USER (`perfume`, superuser) trên DB `perfume_shop`.
-- Tạo thêm DB test. Không cần shadow DB cố định: `perfume` là superuser nên
-- `prisma migrate dev` tự tạo/xoá shadow DB tạm.

CREATE DATABASE perfume_shop_test OWNER perfume;
