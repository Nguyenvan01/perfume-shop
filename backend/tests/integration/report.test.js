'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/config/database');
const { truncateAll } = require('../setup');
const { seedRbac, createUser, loginAs } = require('../helpers/auth');
const { createBrand, createCategory, createProduct } = require('../helpers/catalog');
const { createOrder } = require('../helpers/order');

const api = (path) => `/api/v1${path}`;

let admin;
let staff;
let customer;
let customerRow;

const DAY = 86_400_000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);

beforeEach(async () => {
  await truncateAll();
  await seedRbac();
  admin = await loginAs('ADMIN');
  staff = await loginAs('STAFF');
  customer = await loginAs('CUSTOMER');
  customerRow = customer.customer;
});

describe('Phân quyền module báo cáo', () => {
  it('CUSTOMER bị 403 ở mọi endpoint báo cáo', async () => {
    const paths = [
      '/reports/dashboard',
      '/reports/revenue',
      '/reports/top-products',
      '/reports/revenue-by-brand',
      '/reports/order-status',
      '/reports/low-stock',
    ];
    const results = await Promise.all(
      paths.map((p) => request(app).get(api(p)).set(customer.authHeader))
    );
    expect(results.map((r) => r.status)).toEqual(paths.map(() => 403));
  });

  it('STAFF xem được báo cáo', async () => {
    const res = await request(app).get(api('/reports/dashboard')).set(staff.authHeader);
    expect(res.status).toBe(200);
  });

  it('không token → 401', async () => {
    expect((await request(app).get(api('/reports/dashboard'))).status).toBe(401);
  });
});

describe('GET /reports/dashboard', () => {
  it('doanh thu CHỈ tính đơn COMPLETED', async () => {
    await createOrder({ customerId: customerRow.id, status: 'COMPLETED', totalAmount: 1_000_000 });
    await createOrder({ customerId: customerRow.id, status: 'COMPLETED', totalAmount: 2_000_000 });
    await createOrder({ customerId: customerRow.id, status: 'PENDING', totalAmount: 9_000_000 });
    await createOrder({ customerId: customerRow.id, status: 'CANCELLED', totalAmount: 5_000_000 });
    await createOrder({ customerId: customerRow.id, status: 'SHIPPING', totalAmount: 7_000_000 });
    await createOrder({ customerId: customerRow.id, status: 'RETURNED', totalAmount: 3_000_000 });

    const res = await request(app).get(api('/reports/dashboard')).set(admin.authHeader);

    expect(res.status).toBe(200);
    // 1tr + 2tr = 3tr. Các đơn PENDING/CANCELLED/SHIPPING/RETURNED không tính.
    expect(Number(res.body.data.revenue)).toBe(3_000_000);
    expect(res.body.data.completed_order_count).toBe(2);
    // order_count là đơn TẠO trong kỳ, khác completed_order_count.
    expect(res.body.data.order_count).toBe(6);
  });

  it('trả đủ KPI tối thiểu theo CLAUDE.md §7', async () => {
    await createProduct({ name: 'Sản phẩm 1' });
    await createProduct({ name: 'Sản phẩm 2' });
    await createOrder({ customerId: customerRow.id, status: 'PENDING', totalAmount: 500_000 });

    const res = await request(app).get(api('/reports/dashboard')).set(admin.authHeader);
    const d = res.body.data;

    expect(d).toHaveProperty('revenue');
    expect(d.order_count).toBe(1);
    expect(d.customer_count).toBeGreaterThanOrEqual(1);
    expect(d.product_count).toBe(2);
    expect(d.pending_order_count).toBe(1);
    expect(d).toHaveProperty('low_stock_count');
    expect(d.range.range).toBe('30d');
  });

  it('range=today chỉ tính đơn hoàn thành hôm nay', async () => {
    await createOrder({
      customerId: customerRow.id,
      status: 'COMPLETED',
      totalAmount: 1_000_000,
      createdAt: new Date(),
    });
    await createOrder({
      customerId: customerRow.id,
      status: 'COMPLETED',
      totalAmount: 5_000_000,
      createdAt: daysAgo(10),
    });

    const today = await request(app).get(api('/reports/dashboard?range=today')).set(admin.authHeader);
    expect(Number(today.body.data.revenue)).toBe(1_000_000);

    const month = await request(app).get(api('/reports/dashboard?range=30d')).set(admin.authHeader);
    expect(Number(month.body.data.revenue)).toBe(6_000_000);
  });

  it('revenue_change_pct so với kỳ trước', async () => {
    // Kỳ hiện tại (7 ngày gần nhất): 2tr. Kỳ trước đó: 1tr → tăng 100%.
    await createOrder({
      customerId: customerRow.id,
      status: 'COMPLETED',
      totalAmount: 2_000_000,
      createdAt: daysAgo(1),
    });
    await createOrder({
      customerId: customerRow.id,
      status: 'COMPLETED',
      totalAmount: 1_000_000,
      createdAt: daysAgo(9),
    });

    const res = await request(app).get(api('/reports/dashboard?range=7d')).set(admin.authHeader);
    expect(Number(res.body.data.revenue)).toBe(2_000_000);
    expect(res.body.data.revenue_change_pct).toBe(100);
  });

  it('kỳ trước không có doanh thu → change_pct null (không chia 0)', async () => {
    await createOrder({
      customerId: customerRow.id,
      status: 'COMPLETED',
      totalAmount: 1_000_000,
      createdAt: new Date(),
    });

    const res = await request(app).get(api('/reports/dashboard?range=today')).set(admin.authHeader);
    expect(res.body.data.revenue_change_pct).toBeNull();
  });

  it('chưa có dữ liệu → trả 0, không lỗi', async () => {
    const res = await request(app).get(api('/reports/dashboard')).set(admin.authHeader);
    expect(res.status).toBe(200);
    expect(Number(res.body.data.revenue)).toBe(0);
    expect(res.body.data.order_count).toBe(0);
  });

  it('range=custom thiếu from/to → 400', async () => {
    const res = await request(app)
      .get(api('/reports/dashboard?range=custom'))
      .set(admin.authHeader);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('requires both');
  });

  it('range=custom với from > to → 400', async () => {
    const res = await request(app)
      .get(api('/reports/dashboard?range=custom&from=2026-10-09&to=2026-10-01'))
      .set(admin.authHeader);
    expect(res.status).toBe(400);
  });

  it('range không hợp lệ → 400', async () => {
    const res = await request(app)
      .get(api('/reports/dashboard?range=last_century'))
      .set(admin.authHeader);
    expect(res.status).toBe(400);
  });
});

describe('GET /reports/revenue', () => {
  it('nhóm theo ngày, chỉ có ngày có doanh thu', async () => {
    await createOrder({
      customerId: customerRow.id,
      status: 'COMPLETED',
      totalAmount: 1_000_000,
      createdAt: daysAgo(1),
    });
    await createOrder({
      customerId: customerRow.id,
      status: 'COMPLETED',
      totalAmount: 500_000,
      createdAt: daysAgo(1),
    });
    await createOrder({
      customerId: customerRow.id,
      status: 'COMPLETED',
      totalAmount: 2_000_000,
      createdAt: daysAgo(3),
    });

    const res = await request(app).get(api('/reports/revenue?range=7d')).set(admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.group_by).toBe('day');
    expect(res.body.data.series).toHaveLength(2);

    const total = res.body.data.series.reduce((sum, row) => sum + Number(row.revenue), 0);
    expect(total).toBe(3_500_000);

    // Hai đơn cùng ngày được gộp vào một điểm.
    const twoOrderDay = res.body.data.series.find((row) => row.order_count === 2);
    expect(Number(twoOrderDay.revenue)).toBe(1_500_000);
  });

  it('series sắp xếp tăng dần theo thời gian', async () => {
    for (const n of [5, 1, 3]) {
      await createOrder({
        customerId: customerRow.id,
        status: 'COMPLETED',
        totalAmount: 100_000,
        createdAt: daysAgo(n),
      });
    }

    const res = await request(app).get(api('/reports/revenue?range=7d')).set(admin.authHeader);
    const periods = res.body.data.series.map((row) => row.period);
    expect([...periods].sort()).toEqual(periods);
  });

  it('group_by=month gộp theo tháng', async () => {
    await createOrder({
      customerId: customerRow.id,
      status: 'COMPLETED',
      totalAmount: 1_000_000,
      createdAt: daysAgo(2),
    });
    await createOrder({
      customerId: customerRow.id,
      status: 'COMPLETED',
      totalAmount: 1_000_000,
      createdAt: daysAgo(5),
    });

    const res = await request(app)
      .get(api('/reports/revenue?range=30d&group_by=month'))
      .set(admin.authHeader);

    expect(res.body.data.group_by).toBe('month');
    expect(res.body.data.series[0].period).toMatch(/^\d{4}-\d{2}$/);
  });

  it('không có doanh thu → series rỗng', async () => {
    const res = await request(app).get(api('/reports/revenue')).set(admin.authHeader);
    expect(res.body.data.series).toEqual([]);
  });
});

describe('GET /reports/top-products', () => {
  it('xếp theo số lượng bán, chỉ tính đơn COMPLETED', async () => {
    const brand = await createBrand('Dior');
    const category = await createCategory('Nam');

    const p1 = await createProduct({
      name: 'Bán chạy',
      brandId: brand.id,
      categoryId: category.id,
      variants: [{ sku: 'TOP-1', volume_ml: 100, price: 500_000, stock: 100 }],
    });
    const p2 = await createProduct({
      name: 'Bán ít',
      brandId: brand.id,
      categoryId: category.id,
      variants: [{ sku: 'TOP-2', volume_ml: 100, price: 500_000, stock: 100 }],
    });

    await createOrder({
      customerId: customerRow.id,
      status: 'COMPLETED',
      totalAmount: 5_000_000,
      items: [
        { variant_id: p1.variants[0].id, quantity: 10, unit_price: 500_000, sku: 'TOP-1' },
        { variant_id: p2.variants[0].id, quantity: 2, unit_price: 500_000, sku: 'TOP-2' },
      ],
    });
    // Đơn chưa hoàn thành không được tính.
    await createOrder({
      customerId: customerRow.id,
      status: 'PENDING',
      totalAmount: 50_000_000,
      items: [{ variant_id: p2.variants[0].id, quantity: 99, unit_price: 500_000, sku: 'TOP-2' }],
    });

    const res = await request(app).get(api('/reports/top-products')).set(admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items[0]).toMatchObject({
      product_name: 'Bán chạy',
      brand_name: 'Dior',
      quantity_sold: 10,
    });
    expect(Number(res.body.data.items[0].revenue)).toBe(5_000_000);
    expect(res.body.data.items[1].quantity_sold).toBe(2);
  });

  it('limit giới hạn số dòng trả về', async () => {
    const products = [];
    for (let i = 0; i < 3; i += 1) {
      products.push(
        await createProduct({
          name: `SP ${i}`,
          variants: [{ sku: `LIM-${i}`, volume_ml: 100, price: 100_000, stock: 50 }],
        })
      );
    }
    await createOrder({
      customerId: customerRow.id,
      status: 'COMPLETED',
      totalAmount: 600_000,
      items: products.map((p, i) => ({
        variant_id: p.variants[0].id,
        quantity: i + 1,
        unit_price: 100_000,
      })),
    });

    const res = await request(app)
      .get(api('/reports/top-products?limit=2'))
      .set(admin.authHeader);
    expect(res.body.data.items).toHaveLength(2);
  });

  it('limit ngoài khoảng cho phép → 400', async () => {
    const res = await request(app)
      .get(api('/reports/top-products?limit=999'))
      .set(admin.authHeader);
    expect(res.status).toBe(400);
  });
});

describe('GET /reports/revenue-by-brand', () => {
  it('tính doanh thu và tỷ trọng theo thương hiệu', async () => {
    const dior = await createBrand('Dior');
    const chanel = await createBrand('Chanel');
    const category = await createCategory('Nam');

    const pd = await createProduct({
      name: 'Dior A',
      brandId: dior.id,
      categoryId: category.id,
      variants: [{ sku: 'BR-D', volume_ml: 100, price: 1_000_000, stock: 50 }],
    });
    const pc = await createProduct({
      name: 'Chanel A',
      brandId: chanel.id,
      categoryId: category.id,
      variants: [{ sku: 'BR-C', volume_ml: 100, price: 1_000_000, stock: 50 }],
    });

    await createOrder({
      customerId: customerRow.id,
      status: 'COMPLETED',
      totalAmount: 4_000_000,
      items: [
        { variant_id: pd.variants[0].id, quantity: 3, unit_price: 1_000_000 },
        { variant_id: pc.variants[0].id, quantity: 1, unit_price: 1_000_000 },
      ],
    });

    const res = await request(app).get(api('/reports/revenue-by-brand')).set(admin.authHeader);

    expect(Number(res.body.data.total_revenue)).toBe(4_000_000);
    expect(res.body.data.items[0]).toMatchObject({ brand_name: 'Dior', share_pct: 75 });
    expect(res.body.data.items[1]).toMatchObject({ brand_name: 'Chanel', share_pct: 25 });
    // Tổng tỷ trọng = 100%.
    const sumShare = res.body.data.items.reduce((sum, row) => sum + row.share_pct, 0);
    expect(sumShare).toBe(100);
  });

  it('chưa có doanh thu → items rỗng, total 0, không chia cho 0', async () => {
    const res = await request(app).get(api('/reports/revenue-by-brand')).set(admin.authHeader);
    expect(res.body.data.items).toEqual([]);
    expect(Number(res.body.data.total_revenue)).toBe(0);
  });
});

describe('GET /reports/order-status', () => {
  it('trả đủ 7 trạng thái kể cả khi count = 0', async () => {
    await createOrder({ customerId: customerRow.id, status: 'PENDING' });
    await createOrder({ customerId: customerRow.id, status: 'PENDING' });
    await createOrder({ customerId: customerRow.id, status: 'COMPLETED' });

    const res = await request(app).get(api('/reports/order-status')).set(admin.authHeader);

    expect(res.body.data.items).toHaveLength(7);
    const counts = Object.fromEntries(res.body.data.items.map((r) => [r.status, r.count]));
    expect(counts.PENDING).toBe(2);
    expect(counts.COMPLETED).toBe(1);
    expect(counts.CANCELLED).toBe(0);
    expect(res.body.data.total).toBe(3);
  });
});

describe('GET /reports/low-stock', () => {
  it('chỉ trả biến thể dưới ngưỡng, sắp xếp tồn tăng dần', async () => {
    await createProduct({
      name: 'Hàng đủ',
      variants: [{ sku: 'LS-OK', volume_ml: 100, price: 100_000, stock: 80 }],
    });
    await createProduct({
      name: 'Sắp hết',
      variants: [{ sku: 'LS-LOW', volume_ml: 100, price: 100_000, stock: 3 }],
    });
    await createProduct({
      name: 'Hết hàng',
      variants: [{ sku: 'LS-ZERO', volume_ml: 100, price: 100_000, stock: 0 }],
    });

    const res = await request(app).get(api('/reports/low-stock')).set(admin.authHeader);

    expect(res.body.data.low_stock_threshold).toBe(5);
    expect(res.body.data.items.map((r) => r.sku)).toEqual(['LS-ZERO', 'LS-LOW']);
    expect(res.body.data.items[0]).toHaveProperty('product_name', 'Hết hàng');
    expect(res.body.data.items[0]).toHaveProperty('brand_name');
  });

  it('sản phẩm đã xóa mềm không xuất hiện', async () => {
    const product = await createProduct({
      name: 'Đã xóa',
      variants: [{ sku: 'LS-DEL', volume_ml: 100, price: 100_000, stock: 1 }],
    });
    await prisma.product.update({ where: { id: product.id }, data: { deleted_at: new Date() } });

    const res = await request(app).get(api('/reports/low-stock')).set(admin.authHeader);
    expect(res.body.data.items.some((r) => r.sku === 'LS-DEL')).toBe(false);
  });
});

describe('Số liệu dashboard khớp với truy vấn trực tiếp DB', () => {
  it('doanh thu dashboard == SUM(total_amount) của đơn COMPLETED', async () => {
    const other = await createUser({ email: 'other-report@test.local' });
    for (const amount of [1_500_000, 2_300_000, 900_000]) {
      await createOrder({ customerId: customerRow.id, status: 'COMPLETED', totalAmount: amount });
    }
    await createOrder({
      customerId: other.customer.id,
      status: 'COMPLETED',
      totalAmount: 1_300_000,
    });
    await createOrder({ customerId: customerRow.id, status: 'PENDING', totalAmount: 9_999_999 });

    const res = await request(app).get(api('/reports/dashboard')).set(admin.authHeader);

    const direct = await prisma.order.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { total_amount: true },
      _count: { id: true },
    });

    expect(Number(res.body.data.revenue)).toBe(Number(direct._sum.total_amount));
    expect(res.body.data.completed_order_count).toBe(direct._count.id);
  });
});
