'use strict';

/** Include dùng chung — nạp 1 lần đủ dữ liệu dựng ProductDTO, tránh N+1. */
const PRODUCT_INCLUDE = {
  brand: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true } },
  variants: {
    orderBy: { volume_ml: 'asc' },
    select: {
      id: true,
      product_id: true,
      sku: true,
      volume_ml: true,
      price: true,
      sale_price: true,
      stock_quantity: true,
      status: true,
    },
  },
  images: {
    orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }, { id: 'asc' }],
    select: { id: true, image_url: true, is_primary: true, sort_order: true },
  },
};

const SORTABLE = ['created_at', 'name'];

module.exports = { PRODUCT_INCLUDE, SORTABLE };
