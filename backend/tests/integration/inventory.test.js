'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/config/database');
const { truncateAll } = require('../setup');
const { seedRbac, loginAs } = require('../helpers/auth');
const { createProduct } = require('../helpers/catalog');

const api = (path) => `/api/v1${path}`;

let admin;
let staff;
let customer;

/** Bất biến hệ thống: tổng lịch sử kho luôn bằng tồn kho hiện tại. */
async function assertStockMatchesHistory() {
  const rows = await prisma.$queryRaw`
    SELECT v.id, v.sku, v.stock_quantity, COALESCE(SUM(t.quantity), 0) AS history
    FROM product_variants v
    LEFT JOIN inventory_transactions t ON t.variant_id = v.id
    GROUP BY v.id, v.sku, v.stock_quantity
    HAVING v.stock_quantity <> COALESCE(SUM(t.quantity), 0)
  `;
  expect(rows).toEqual([]);
}

beforeEach(async () => {
  await truncateAll();
  await seedRbac();
  admin = await loginAs('ADMIN');
  staff = await loginAs('STAFF');
  customer = await loginAs('CUSTOMER');
});

describe('Phân quyền module kho', () => {
  it('CUSTOMER bị 403 ở mọi endpoint kho', async () => {
    const endpoints = [
      request(app).get(api('/inventory')).set(customer.authHeader),
      request(app).get(api('/inventory/summary')).set(customer.authHeader),
      request(app).get(api('/inventory/transactions')).set(customer.authHeader),
      request(app).post(api('/inventory/import')).set(customer.authHeader).send({ items: [] }),
    ];
    const results = await Promise.all(endpoints);
    expect(results.map((res) => res.status)).toEqual([403, 403, 403, 403]);
  });

  it('STAFF nhập/xuất được nhưng không điều chỉnh được kho', async () => {
    const product = await createProduct({
      variants: [{ sku: 'STAFF-100', volume_ml: 100, price: 100000, stock: 0 }],
    });
    const variantId = product.variants[0].id;

    const importRes = await request(app)
      .post(api('/inventory/import'))
      .set(staff.authHeader)
      .send({ items: [{ variant_id: variantId, quantity: 10 }], note: 'Staff nhập' });
    expect(importRes.status).toBe(201);

    const adjustRes = await request(app)
      .post(api('/inventory/adjustment'))
      .set(staff.authHeader)
      .send({ variant_id: variantId, new_quantity: 50, note: 'Staff thử điều chỉnh' });
    expect(adjustRes.status).toBe(403);
  });

  it('không có token → 401', async () => {
    expect((await request(app).get(api('/inventory'))).status).toBe(401);
  });
});

describe('POST /inventory/import', () => {
  it('nhập kho ghi transaction IMPORT với stock_before/after đúng', async () => {
    const product = await createProduct({
      variants: [{ sku: 'IMP-100', volume_ml: 100, price: 100000, stock: 0 }],
    });
    const variantId = product.variants[0].id;

    const res = await request(app)
      .post(api('/inventory/import'))
      .set(admin.authHeader)
      .send({ items: [{ variant_id: variantId, quantity: 100 }], note: 'Nhập lô đầu' });

    expect(res.status).toBe(201);
    const txn = res.body.data.transactions[0];
    expect(txn).toMatchObject({
      type: 'IMPORT',
      quantity: 100,
      stock_before: 0,
      stock_after: 100,
      note: 'Nhập lô đầu',
    });
    expect(txn.variant.sku).toBe('IMP-100');
    expect(txn.created_by.id).toBe(admin.user.id);

    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    expect(variant.stock_quantity).toBe(100);
    await assertStockMatchesHistory();
  });

  it('nhập nhiều dòng trong 1 phiếu', async () => {
    const product = await createProduct({
      variants: [
        { sku: 'MULTI-30', volume_ml: 30, price: 100000, stock: 0 },
        { sku: 'MULTI-100', volume_ml: 100, price: 200000, stock: 0 },
      ],
    });

    const res = await request(app)
      .post(api('/inventory/import'))
      .set(admin.authHeader)
      .send({
        items: [
          { variant_id: product.variants[0].id, quantity: 20 },
          { variant_id: product.variants[1].id, quantity: 30 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.transactions).toHaveLength(2);
    await assertStockMatchesHistory();
  });

  it('một dòng sai variant → cả phiếu rollback, kho không đổi', async () => {
    const product = await createProduct({
      variants: [{ sku: 'ROLLBACK-100', volume_ml: 100, price: 100000, stock: 5 }],
    });
    const variantId = product.variants[0].id;

    const res = await request(app)
      .post(api('/inventory/import'))
      .set(admin.authHeader)
      .send({
        items: [
          { variant_id: variantId, quantity: 50 },
          { variant_id: 999999, quantity: 10 },
        ],
      });

    expect(res.status).toBe(404);

    // Dòng đầu KHÔNG được commit.
    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    expect(variant.stock_quantity).toBe(5);
    expect(await prisma.inventoryTransaction.count({ where: { variant_id: variantId } })).toBe(1);
    await assertStockMatchesHistory();
  });

  it('cùng variant xuất hiện 2 lần trong 1 phiếu → 400', async () => {
    const product = await createProduct({
      variants: [{ sku: 'DUPITEM-100', volume_ml: 100, price: 100000, stock: 0 }],
    });
    const variantId = product.variants[0].id;

    const res = await request(app)
      .post(api('/inventory/import'))
      .set(admin.authHeader)
      .send({
        items: [
          { variant_id: variantId, quantity: 5 },
          { variant_id: variantId, quantity: 10 },
        ],
      });

    expect(res.status).toBe(400);
  });

  it('quantity = 0 hoặc âm → 400', async () => {
    const product = await createProduct({
      variants: [{ sku: 'BADQTY-100', volume_ml: 100, price: 100000, stock: 0 }],
    });
    const variantId = product.variants[0].id;

    for (const quantity of [0, -5]) {
      const res = await request(app)
        .post(api('/inventory/import'))
        .set(admin.authHeader)
        .send({ items: [{ variant_id: variantId, quantity }] });
      expect(res.status).toBe(400);
    }
  });

  it('items rỗng → 400', async () => {
    const res = await request(app)
      .post(api('/inventory/import'))
      .set(admin.authHeader)
      .send({ items: [] });
    expect(res.status).toBe(400);
  });
});

describe('POST /inventory/export', () => {
  it('xuất kho ghi transaction EXPORT với quantity âm', async () => {
    const product = await createProduct({
      variants: [{ sku: 'EXP-100', volume_ml: 100, price: 100000, stock: 50 }],
    });
    const variantId = product.variants[0].id;

    const res = await request(app)
      .post(api('/inventory/export'))
      .set(admin.authHeader)
      .send({ items: [{ variant_id: variantId, quantity: 20 }], note: 'Xuất mẫu' });

    expect(res.status).toBe(201);
    expect(res.body.data.transactions[0]).toMatchObject({
      type: 'EXPORT',
      quantity: -20,
      stock_before: 50,
      stock_after: 30,
    });

    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    expect(variant.stock_quantity).toBe(30);
    await assertStockMatchesHistory();
  });

  it('xuất quá tồn kho → 422 và kho không đổi', async () => {
    const product = await createProduct({
      variants: [{ sku: 'OVEREXP-100', volume_ml: 100, price: 100000, stock: 5 }],
    });
    const variantId = product.variants[0].id;

    const res = await request(app)
      .post(api('/inventory/export'))
      .set(admin.authHeader)
      .send({ items: [{ variant_id: variantId, quantity: 6 }] });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('Insufficient stock');
    expect(res.body.message).toContain('OVEREXP-100');

    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    expect(variant.stock_quantity).toBe(5);
    await assertStockMatchesHistory();
  });

  it('xuất đúng bằng tồn kho → về 0, vẫn hợp lệ', async () => {
    const product = await createProduct({
      variants: [{ sku: 'EXACT-100', volume_ml: 100, price: 100000, stock: 7 }],
    });

    const res = await request(app)
      .post(api('/inventory/export'))
      .set(admin.authHeader)
      .send({ items: [{ variant_id: product.variants[0].id, quantity: 7 }] });

    expect(res.status).toBe(201);
    expect(res.body.data.transactions[0].stock_after).toBe(0);
    await assertStockMatchesHistory();
  });

  it('phiếu xuất nhiều dòng, dòng sau thiếu hàng → cả phiếu rollback', async () => {
    const product = await createProduct({
      variants: [
        { sku: 'PARTIAL-30', volume_ml: 30, price: 100000, stock: 10 },
        { sku: 'PARTIAL-100', volume_ml: 100, price: 200000, stock: 1 },
      ],
    });

    const res = await request(app)
      .post(api('/inventory/export'))
      .set(admin.authHeader)
      .send({
        items: [
          { variant_id: product.variants[0].id, quantity: 5 },
          { variant_id: product.variants[1].id, quantity: 99 },
        ],
      });

    expect(res.status).toBe(422);

    const first = await prisma.productVariant.findUnique({ where: { id: product.variants[0].id } });
    expect(first.stock_quantity).toBe(10);
    await assertStockMatchesHistory();
  });
});

describe('POST /inventory/adjustment', () => {
  it('điều chỉnh tăng: ghi delta dương, không ghi số tuyệt đối', async () => {
    const product = await createProduct({
      variants: [{ sku: 'ADJUP-100', volume_ml: 100, price: 100000, stock: 10 }],
    });

    const res = await request(app)
      .post(api('/inventory/adjustment'))
      .set(admin.authHeader)
      .send({ variant_id: product.variants[0].id, new_quantity: 15, note: 'Kiểm kê thừa 5' });

    expect(res.status).toBe(201);
    expect(res.body.data.transaction).toMatchObject({
      type: 'ADJUSTMENT',
      quantity: 5,
      stock_before: 10,
      stock_after: 15,
    });
    await assertStockMatchesHistory();
  });

  it('điều chỉnh giảm: delta âm', async () => {
    const product = await createProduct({
      variants: [{ sku: 'ADJDOWN-100', volume_ml: 100, price: 100000, stock: 10 }],
    });

    const res = await request(app)
      .post(api('/inventory/adjustment'))
      .set(admin.authHeader)
      .send({ variant_id: product.variants[0].id, new_quantity: 3, note: 'Kiểm kê thiếu 7' });

    expect(res.body.data.transaction.quantity).toBe(-7);
    expect(res.body.data.transaction.stock_after).toBe(3);
    await assertStockMatchesHistory();
  });

  it('thiếu note → 400', async () => {
    const product = await createProduct({
      variants: [{ sku: 'NONOTE-100', volume_ml: 100, price: 100000, stock: 10 }],
    });

    const res = await request(app)
      .post(api('/inventory/adjustment'))
      .set(admin.authHeader)
      .send({ variant_id: product.variants[0].id, new_quantity: 5 });

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field.includes('note'))).toBe(true);
  });

  it('new_quantity âm → 400', async () => {
    const product = await createProduct({
      variants: [{ sku: 'NEGADJ-100', volume_ml: 100, price: 100000, stock: 10 }],
    });

    const res = await request(app)
      .post(api('/inventory/adjustment'))
      .set(admin.authHeader)
      .send({ variant_id: product.variants[0].id, new_quantity: -1, note: 'Số âm' });

    expect(res.status).toBe(400);
  });

  it('new_quantity bằng tồn hiện tại → 400, không ghi transaction rỗng', async () => {
    const product = await createProduct({
      variants: [{ sku: 'SAMEADJ-100', volume_ml: 100, price: 100000, stock: 10 }],
    });

    const res = await request(app)
      .post(api('/inventory/adjustment'))
      .set(admin.authHeader)
      .send({ variant_id: product.variants[0].id, new_quantity: 10, note: 'Không đổi' });

    expect(res.status).toBe(400);
    expect(
      await prisma.inventoryTransaction.count({
        where: { variant_id: product.variants[0].id, type: 'ADJUSTMENT' },
      })
    ).toBe(0);
  });
});

describe('GET /inventory', () => {
  beforeEach(async () => {
    await createProduct({
      name: 'Hết hàng',
      variants: [{ sku: 'ZERO-100', volume_ml: 100, price: 100000, stock: 0 }],
    });
    await createProduct({
      name: 'Sắp hết',
      variants: [{ sku: 'LOW-100', volume_ml: 100, price: 100000, stock: 3 }],
    });
    await createProduct({
      name: 'Dư hàng',
      variants: [{ sku: 'PLENTY-100', volume_ml: 100, price: 100000, stock: 80 }],
    });
  });

  it('mặc định sắp xếp tồn kho tăng dần và gắn cờ low/out of stock', async () => {
    const res = await request(app).get(api('/inventory')).set(admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.map((row) => row.sku)).toEqual(['ZERO-100', 'LOW-100', 'PLENTY-100']);
    expect(res.body.data[0]).toMatchObject({ is_out_of_stock: true, is_low_stock: true });
    expect(res.body.data[2]).toMatchObject({ is_out_of_stock: false, is_low_stock: false });
    expect(res.body.data[0].product_name).toBe('Hết hàng');
    expect(res.body.data[0].brand_name).toBeTruthy();
  });

  it('low_stock=true chỉ trả hàng dưới ngưỡng', async () => {
    const res = await request(app).get(api('/inventory?low_stock=true')).set(admin.authHeader);
    expect(res.body.data.map((row) => row.sku).sort()).toEqual(['LOW-100', 'ZERO-100']);
  });

  it('out_of_stock=true chỉ trả hàng đã hết', async () => {
    const res = await request(app).get(api('/inventory?out_of_stock=true')).set(admin.authHeader);
    expect(res.body.data.map((row) => row.sku)).toEqual(['ZERO-100']);
  });

  it('tìm theo SKU và theo tên sản phẩm', async () => {
    const bySku = await request(app).get(api('/inventory?q=LOW-')).set(admin.authHeader);
    expect(bySku.body.data).toHaveLength(1);

    const byName = await request(app).get(api('/inventory?q=Dư hàng')).set(admin.authHeader);
    expect(byName.body.data.map((row) => row.sku)).toEqual(['PLENTY-100']);
  });

  it('GET /inventory/low-stock trả cùng dữ liệu với filter low_stock', async () => {
    const res = await request(app).get(api('/inventory/low-stock')).set(admin.authHeader);
    expect(res.body.data.every((row) => row.is_low_stock)).toBe(true);
  });
});

describe('GET /inventory/summary', () => {
  it('tổng hợp đúng số lượng và giá trị kho', async () => {
    await createProduct({
      variants: [
        { sku: 'SUM-30', volume_ml: 30, price: 100000, stock: 0 },
        { sku: 'SUM-100', volume_ml: 100, price: 200000, stock: 4 },
        { sku: 'SUM-200', volume_ml: 200, price: 300000, stock: 10 },
      ],
    });

    const res = await request(app).get(api('/inventory/summary')).set(admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      total_variants: 3,
      total_stock: 14,
      out_of_stock_count: 1,
      low_stock_count: 1,
      low_stock_threshold: 5,
    });
    // 4*200000 + 10*300000 = 3.800.000
    expect(Number(res.body.data.stock_value)).toBe(3_800_000);
  });
});

describe('GET /inventory/transactions', () => {
  it('lọc theo type, variant và trả mới nhất trước', async () => {
    const product = await createProduct({
      variants: [{ sku: 'HIST-100', volume_ml: 100, price: 100000, stock: 0 }],
    });
    const variantId = product.variants[0].id;

    await request(app)
      .post(api('/inventory/import'))
      .set(admin.authHeader)
      .send({ items: [{ variant_id: variantId, quantity: 100 }] });
    await request(app)
      .post(api('/inventory/export'))
      .set(admin.authHeader)
      .send({ items: [{ variant_id: variantId, quantity: 10 }] });

    const all = await request(app)
      .get(api(`/inventory/transactions?variant_id=${variantId}`))
      .set(admin.authHeader);
    expect(all.body.data).toHaveLength(2);
    expect(all.body.data[0].type).toBe('EXPORT');

    const onlyImport = await request(app)
      .get(api(`/inventory/transactions?variant_id=${variantId}&type=IMPORT`))
      .set(admin.authHeader);
    expect(onlyImport.body.data).toHaveLength(1);
    expect(onlyImport.body.data[0].stock_after).toBe(100);
  });

  it('lọc theo khoảng thời gian', async () => {
    const product = await createProduct({
      variants: [{ sku: 'DATE-100', volume_ml: 100, price: 100000, stock: 5 }],
    });

    const future = new Date(Date.now() + 86_400_000).toISOString();
    const res = await request(app)
      .get(api(`/inventory/transactions?from=${future}`))
      .set(admin.authHeader);

    expect(res.body.data).toHaveLength(0);
    expect(product.variants[0].sku).toBe('DATE-100');
  });

  it('type không hợp lệ → 400', async () => {
    const res = await request(app)
      .get(api('/inventory/transactions?type=KHONG_TON_TAI'))
      .set(admin.authHeader);
    expect(res.status).toBe(400);
  });
});

describe('Bất biến tồn kho qua nhiều thao tác', () => {
  it('chuỗi IMPORT → EXPORT → ADJUSTMENT giữ stock khớp lịch sử', async () => {
    const product = await createProduct({
      variants: [{ sku: 'CHAIN-100', volume_ml: 100, price: 100000, stock: 0 }],
    });
    const variantId = product.variants[0].id;

    await request(app)
      .post(api('/inventory/import'))
      .set(admin.authHeader)
      .send({ items: [{ variant_id: variantId, quantity: 100 }] });
    await request(app)
      .post(api('/inventory/export'))
      .set(admin.authHeader)
      .send({ items: [{ variant_id: variantId, quantity: 30 }] });
    await request(app)
      .post(api('/inventory/adjustment'))
      .set(admin.authHeader)
      .send({ variant_id: variantId, new_quantity: 68, note: 'Kiểm kê thiếu 2' });

    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    expect(variant.stock_quantity).toBe(68);

    const txns = await prisma.inventoryTransaction.findMany({
      where: { variant_id: variantId },
      orderBy: { id: 'asc' },
    });
    expect(txns.map((t) => t.quantity)).toEqual([100, -30, -2]);
    await assertStockMatchesHistory();
  });

  it('hai lệnh xuất đồng thời trên variant chỉ còn 1: đúng một lệnh thành công', async () => {
    const product = await createProduct({
      variants: [{ sku: 'RACE-100', volume_ml: 100, price: 100000, stock: 1 }],
    });
    const variantId = product.variants[0].id;

    const [first, second] = await Promise.all([
      request(app)
        .post(api('/inventory/export'))
        .set(admin.authHeader)
        .send({ items: [{ variant_id: variantId, quantity: 1 }] }),
      request(app)
        .post(api('/inventory/export'))
        .set(admin.authHeader)
        .send({ items: [{ variant_id: variantId, quantity: 1 }] }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 422]);

    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    expect(variant.stock_quantity).toBe(0);
    await assertStockMatchesHistory();
  });
});
