'use strict';

const { prisma } = require('../../src/config/database');
const { slugify } = require('../../src/utils/slug');

/** Tạo brand/category tối thiểu để test product. */
async function createBrand(name = 'Dior') {
  return prisma.brand.create({ data: { name, slug: slugify(name) } });
}

async function createCategory(name = 'Nước hoa nam') {
  return prisma.category.create({ data: { name, slug: slugify(name) } });
}

/**
 * Tạo product kèm variant. Stock được set trực tiếp + ghi transaction IMPORT
 * để giữ bất biến: SUM(inventory_transactions.quantity) == stock_quantity.
 */
let fixtureCounter = 0;

async function createProduct({
  name = 'Dior Sauvage EDP',
  brandId,
  categoryId,
  gender = 'MALE',
  concentration = 'EDP',
  status = 'ACTIVE',
  variants,
} = {}) {
  // SKU mặc định phải duy nhất: nhiều test tạo vài product trong cùng một case.
  fixtureCounter += 1;
  const variantList = variants ?? [
    { sku: `FIXTURE-${fixtureCounter}-100`, volume_ml: 100, price: 4150000, stock: 10 },
  ];
  const brand_id = brandId ?? (await createBrand(`Brand ${Date.now()}`)).id;
  const category_id = categoryId ?? (await createCategory(`Cat ${Date.now()}`)).id;

  const product = await prisma.product.create({
    data: { name, slug: slugify(`${name}-${Date.now()}`), brand_id, category_id, gender, concentration, status },
  });

  for (const variant of variantList) {
    const created = await prisma.productVariant.create({
      data: {
        product_id: product.id,
        sku: variant.sku,
        volume_ml: variant.volume_ml,
        price: variant.price,
        sale_price: variant.sale_price ?? null,
        status: variant.status ?? 'ACTIVE',
      },
    });

    const stock = variant.stock ?? 0;
    if (stock > 0) {
      await prisma.$transaction([
        prisma.productVariant.update({ where: { id: created.id }, data: { stock_quantity: stock } }),
        prisma.inventoryTransaction.create({
          data: {
            variant_id: created.id,
            type: 'IMPORT',
            quantity: stock,
            stock_before: 0,
            stock_after: stock,
            note: 'test fixture',
          },
        }),
      ]);
    }
  }

  return prisma.product.findUnique({ where: { id: product.id }, include: { variants: true } });
}

/** Buffer PNG 1x1 hợp lệ — dùng để test upload mà không cần file thật. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64'
);

module.exports = { createBrand, createCategory, createProduct, PNG_1X1 };
