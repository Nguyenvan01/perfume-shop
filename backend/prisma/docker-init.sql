-- Chạy 1 lần khi container khởi tạo volume lần đầu.
-- Tạo DB test + DB shadow (Prisma Migrate cần shadow DB để diff schema), rồi cấp quyền.

CREATE DATABASE IF NOT EXISTS perfume_shop_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS perfume_shop_shadow
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON perfume_shop.* TO 'perfume'@'%';
GRANT ALL PRIVILEGES ON perfume_shop_test.* TO 'perfume'@'%';
GRANT ALL PRIVILEGES ON perfume_shop_shadow.* TO 'perfume'@'%';
FLUSH PRIVILEGES;
