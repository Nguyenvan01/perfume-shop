-- SKU dạng chuẩn = TRIM + UPPER (xem src/utils/sku.js).
-- PostgreSQL so sánh phân biệt hoa/thường: UNIQUE(sku) chỉ chặn được "abc-1" vs "ABC-1"
-- khi mọi SKU được lưu cùng một dạng. App chuẩn hóa trước mọi lần ghi/tra cứu.
--
-- Nếu dữ liệu cũ có hai SKU chỉ khác hoa/thường, UPDATE dưới đây vi phạm unique index và
-- migration dừng lại — cần xử lý tay (đổi một SKU) rồi chạy lại, không được tự gộp.
UPDATE "product_variants" SET "sku" = UPPER(TRIM("sku")) WHERE "sku" <> UPPER(TRIM("sku"));

-- Chặn ở tầng DB mọi nguồn ghi bỏ qua app (seed, script, SQL tay).
-- Prisma schema không biểu diễn CHECK constraint; Prisma Migrate bỏ qua nó khi diff
-- (không sinh lệnh DROP, không báo drift) nên chỉ cần khai báo ở migration này.
ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_sku_canonical_check" CHECK ("sku" = UPPER(TRIM("sku")));
