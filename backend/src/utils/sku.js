'use strict';

/**
 * Dạng chuẩn của SKU: bỏ khoảng trắng hai đầu + viết HOA.
 *
 * PostgreSQL so sánh chuỗi phân biệt hoa/thường, nên UNIQUE(sku) chỉ chặn được trùng
 * "abc-1" = "ABC-1" nếu mọi SKU được lưu cùng một dạng. Chuẩn hóa trước MỌI lần ghi
 * và tra cứu → unique index của DB chặn trùng một cách atomic (kể cả request đồng thời);
 * kiểm tra trước ở service chỉ để trả message thân thiện. DB có thêm CHECK constraint
 * `product_variants_sku_canonical_check` cho bất kỳ nguồn ghi nào khác (seed, script).
 */
const normalizeSku = (sku) => String(sku).trim().toUpperCase();

module.exports = { normalizeSku };
