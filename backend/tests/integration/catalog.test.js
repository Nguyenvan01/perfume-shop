'use strict';

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../../src/app');
const { prisma } = require('../../src/config/database');
const { truncateAll } = require('../setup');
const { seedRbac, loginAs } = require('../helpers/auth');
const { createBrand, createCategory, createProduct, PNG_1X1 } = require('../helpers/catalog');

const api = (path_) => `/api/v1${path_}`;
const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');

let admin;
let staff;
let customer;

// Test upload ghi file thật xuống uploads/products — dọn sau khi chạy xong để
// không để lại rác trong workspace.
afterAll(() => {
  fs.rmSync(path.join(UPLOAD_ROOT, 'products'), { recursive: true, force: true });
});

beforeEach(async () => {
  await truncateAll();
  await seedRbac();
  admin = await loginAs('ADMIN');
  staff = await loginAs('STAFF');
  customer = await loginAs('CUSTOMER');
});

describe('Brands', () => {
  it('tạo brand tự sinh slug bỏ dấu tiếng Việt', async () => {
    const res = await request(app)
      .post(api('/brands'))
      .set(admin.authHeader)
      .send({ name: 'Nước Hoa Việt', description: 'Thương hiệu Việt' });

    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('nuoc-hoa-viet');
  });

  it('tên trùng → slug tự thêm hậu tố, không lỗi', async () => {
    await request(app).post(api('/brands')).set(admin.authHeader).send({ name: 'Dior' });
    const second = await request(app).post(api('/brands')).set(admin.authHeader).send({ name: 'Dior' });

    expect(second.status).toBe(201);
    expect(second.body.data.slug).toBe('dior-2');
  });

  it('khách chỉ thấy brand ACTIVE, admin thấy cả INACTIVE', async () => {
    await request(app)
      .post(api('/brands'))
      .set(admin.authHeader)
      .send({ name: 'Ẩn', status: 'INACTIVE' });
    await request(app).post(api('/brands')).set(admin.authHeader).send({ name: 'Hiện' });

    const publicRes = await request(app).get(api('/brands'));
    expect(publicRes.body.data.map((b) => b.name)).toEqual(['Hiện']);

    const adminRes = await request(app).get(api('/brands')).set(admin.authHeader);
    expect(adminRes.body.data).toHaveLength(2);
  });

  it('CUSTOMER tạo brand → 403; STAFF tạo được; chỉ ADMIN xóa được', async () => {
    const byCustomer = await request(app)
      .post(api('/brands'))
      .set(customer.authHeader)
      .send({ name: 'Không được' });
    expect(byCustomer.status).toBe(403);

    const byStaff = await request(app)
      .post(api('/brands'))
      .set(staff.authHeader)
      .send({ name: 'Staff tạo' });
    expect(byStaff.status).toBe(201);

    const deleteByStaff = await request(app)
      .delete(api(`/brands/${byStaff.body.data.id}`))
      .set(staff.authHeader);
    expect(deleteByStaff.status).toBe(403);

    const deleteByAdmin = await request(app)
      .delete(api(`/brands/${byStaff.body.data.id}`))
      .set(admin.authHeader);
    expect(deleteByAdmin.status).toBe(200);
  });

  it('xóa brand còn sản phẩm → 409', async () => {
    const brand = await createBrand('Có sản phẩm');
    await createProduct({ brandId: brand.id });

    const res = await request(app).delete(api(`/brands/${brand.id}`)).set(admin.authHeader);
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('product');
  });

  it('soft delete: brand mất khỏi list nhưng row còn trong DB', async () => {
    const brand = await createBrand('Sẽ xóa');
    await request(app).delete(api(`/brands/${brand.id}`)).set(admin.authHeader);

    const list = await request(app).get(api('/brands')).set(admin.authHeader);
    expect(list.body.data.some((b) => b.id === brand.id)).toBe(false);
    expect(await prisma.brand.findUnique({ where: { id: brand.id } })).not.toBeNull();
  });
});

describe('Categories', () => {
  it('CRUD cơ bản hoạt động', async () => {
    const created = await request(app)
      .post(api('/categories'))
      .set(admin.authHeader)
      .send({ name: 'Gift Set' });
    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe('gift-set');

    const updated = await request(app)
      .put(api(`/categories/${created.body.data.id}`))
      .set(admin.authHeader)
      .send({ description: 'Bộ quà tặng' });
    expect(updated.body.data.description).toBe('Bộ quà tặng');

    const removed = await request(app)
      .delete(api(`/categories/${created.body.data.id}`))
      .set(admin.authHeader);
    expect(removed.status).toBe(200);
  });

  it('xóa category còn sản phẩm → 409', async () => {
    const category = await createCategory('Đang dùng');
    await createProduct({ categoryId: category.id });

    const res = await request(app).delete(api(`/categories/${category.id}`)).set(admin.authHeader);
    expect(res.status).toBe(409);
  });
});

describe('TC03 — tạo product hợp lệ', () => {
  it('tạo product kèm variants → 201, DTO đủ brand/category/price_range/total_stock', async () => {
    const brand = await createBrand('Dior');
    const category = await createCategory('Nước hoa nam');

    const res = await request(app)
      .post(api('/products'))
      .set(admin.authHeader)
      .send({
        name: 'Dior Sauvage Eau de Parfum',
        brand_id: brand.id,
        category_id: category.id,
        gender: 'MALE',
        concentration: 'EDP',
        origin: 'Pháp',
        fragrance_family: 'Woody Aromatic',
        description: 'Hương gỗ thơm nam tính',
        variants: [
          { sku: 'DIOR-SAUV-EDP-30', volume_ml: 30, price: 2150000 },
          { sku: 'DIOR-SAUV-EDP-100', volume_ml: 100, price: 4150000, sale_price: 3890000 },
        ],
      });

    expect(res.status).toBe(201);
    const data = res.body.data;
    expect(data.slug).toBe('dior-sauvage-eau-de-parfum');
    expect(data.brand).toMatchObject({ id: brand.id, name: 'Dior' });
    expect(data.category).toMatchObject({ id: category.id });
    expect(data.variants).toHaveLength(2);

    // Product không giữ giá/stock — tính từ variants. sale_price là giá hiệu lực.
    expect(data.price_range).toEqual({ min: 2150000, max: 3890000 });
    expect(data.total_stock).toBe(0);
    expect(data).not.toHaveProperty('price');
    expect(data).not.toHaveProperty('stock_quantity');
  });

  it('variant mới luôn bắt đầu stock = 0 dù payload có gửi stock_quantity', async () => {
    const brand = await createBrand('B');
    const category = await createCategory('C');

    const res = await request(app)
      .post(api('/products'))
      .set(admin.authHeader)
      .send({
        name: 'Thử stock',
        brand_id: brand.id,
        category_id: category.id,
        gender: 'UNISEX',
        concentration: 'EDT',
        variants: [{ sku: 'TRY-STOCK-50', volume_ml: 50, price: 100000, stock_quantity: 999 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.variants[0].stock_quantity).toBe(0);
  });

  it('brand_id không tồn tại → 404', async () => {
    const category = await createCategory('C');
    const res = await request(app)
      .post(api('/products'))
      .set(admin.authHeader)
      .send({
        name: 'Brand rác',
        brand_id: 99999,
        category_id: category.id,
        gender: 'MALE',
        concentration: 'EDP',
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Brand not found');
  });

  it('thiếu field bắt buộc → 400 kèm errors[]', async () => {
    const res = await request(app)
      .post(api('/products'))
      .set(admin.authHeader)
      .send({ name: 'Thiếu field' });

    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toContain('brand_id');
    expect(fields).toContain('category_id');
  });

  it('SKU trùng nhau trong cùng payload → 409', async () => {
    const brand = await createBrand('B');
    const category = await createCategory('C');

    const res = await request(app)
      .post(api('/products'))
      .set(admin.authHeader)
      .send({
        name: 'SKU trùng',
        brand_id: brand.id,
        category_id: category.id,
        gender: 'MALE',
        concentration: 'EDP',
        variants: [
          { sku: 'DUP-SKU', volume_ml: 30, price: 100000 },
          { sku: 'DUP-SKU', volume_ml: 50, price: 200000 },
        ],
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Duplicated SKU');
  });

  it('SKU đã tồn tại trong DB → 409', async () => {
    await createProduct({ variants: [{ sku: 'EXISTING-SKU', volume_ml: 100, price: 100000 }] });
    const brand = await createBrand('B2');
    const category = await createCategory('C2');

    const res = await request(app)
      .post(api('/products'))
      .set(admin.authHeader)
      .send({
        name: 'SKU đã có',
        brand_id: brand.id,
        category_id: category.id,
        gender: 'MALE',
        concentration: 'EDP',
        variants: [{ sku: 'EXISTING-SKU', volume_ml: 50, price: 100000 }],
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('EXISTING-SKU');
  });

  it('sale_price > price → 400', async () => {
    const brand = await createBrand('B3');
    const category = await createCategory('C3');

    const res = await request(app)
      .post(api('/products'))
      .set(admin.authHeader)
      .send({
        name: 'Sale cao hơn giá',
        brand_id: brand.id,
        category_id: category.id,
        gender: 'MALE',
        concentration: 'EDP',
        variants: [{ sku: 'BAD-SALE-30', volume_ml: 30, price: 100000, sale_price: 200000 }],
      });

    expect(res.status).toBe(400);
  });

  it('CUSTOMER tạo product → 403', async () => {
    const brand = await createBrand('B4');
    const category = await createCategory('C4');

    const res = await request(app)
      .post(api('/products'))
      .set(customer.authHeader)
      .send({
        name: 'Khách tạo',
        brand_id: brand.id,
        category_id: category.id,
        gender: 'MALE',
        concentration: 'EDP',
      });

    expect(res.status).toBe(403);
  });
});

describe('GET /products — filter, sort, pagination', () => {
  let brandA;
  let brandB;
  let categoryMale;

  beforeEach(async () => {
    brandA = await createBrand('Alpha');
    brandB = await createBrand('Beta');
    categoryMale = await createCategory('Nam');

    await createProduct({
      name: 'Alpha Nam EDP',
      brandId: brandA.id,
      categoryId: categoryMale.id,
      gender: 'MALE',
      concentration: 'EDP',
      variants: [{ sku: 'A-100', volume_ml: 100, price: 1000000, stock: 5 }],
    });
    await createProduct({
      name: 'Beta Nữ EDT',
      brandId: brandB.id,
      gender: 'FEMALE',
      concentration: 'EDT',
      variants: [{ sku: 'B-50', volume_ml: 50, price: 3000000, stock: 0 }],
    });
    await createProduct({
      name: 'Beta Unisex ẩn',
      brandId: brandB.id,
      gender: 'UNISEX',
      status: 'INACTIVE',
      variants: [{ sku: 'C-30', volume_ml: 30, price: 500000, stock: 2 }],
    });
  });

  it('khách chỉ thấy product ACTIVE', async () => {
    const res = await request(app).get(api('/products'));
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.every((p) => p.status === 'ACTIVE')).toBe(true);
  });

  it('admin thấy cả INACTIVE', async () => {
    const res = await request(app).get(api('/products')).set(admin.authHeader);
    expect(res.body.meta.total).toBe(3);
  });

  it('filter brand_id, gender, concentration', async () => {
    const byBrand = await request(app).get(api(`/products?brand_id=${brandA.id}`));
    expect(byBrand.body.data).toHaveLength(1);
    expect(byBrand.body.data[0].name).toBe('Alpha Nam EDP');

    const byGender = await request(app).get(api('/products?gender=FEMALE'));
    expect(byGender.body.data).toHaveLength(1);

    const byConcentration = await request(app).get(api('/products?concentration=EDP'));
    expect(byConcentration.body.data).toHaveLength(1);
  });

  it('filter khoảng giá dựa trên giá variant', async () => {
    const cheap = await request(app).get(api('/products?max_price=1500000'));
    expect(cheap.body.data.map((p) => p.name)).toEqual(['Alpha Nam EDP']);

    const expensive = await request(app).get(api('/products?min_price=2000000'));
    expect(expensive.body.data.map((p) => p.name)).toEqual(['Beta Nữ EDT']);
  });

  it('min_price > max_price → 400', async () => {
    const res = await request(app).get(api('/products?min_price=500&max_price=100'));
    expect(res.status).toBe(400);
  });

  it('in_stock=true loại product hết hàng', async () => {
    const res = await request(app).get(api('/products?in_stock=true'));
    expect(res.body.data.map((p) => p.name)).toEqual(['Alpha Nam EDP']);
  });

  it('tìm q theo tên sản phẩm và tên brand', async () => {
    const byName = await request(app).get(api('/products?q=Alpha'));
    expect(byName.body.data).toHaveLength(1);

    const byBrandName = await request(app).get(api('/products?q=Beta'));
    expect(byBrandName.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('pagination trả meta đúng', async () => {
    const res = await request(app).get(api('/products?limit=1&page=2'));
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 2, limit: 1, total: 2, totalPages: 2 });
  });

  it('sort=price:asc sắp theo giá thấp nhất của variant', async () => {
    const res = await request(app).get(api('/products?sort=price:asc'));
    expect(res.body.data.map((p) => p.name)).toEqual(['Alpha Nam EDP', 'Beta Nữ EDT']);
  });
});

describe('GET /products/:id — id hoặc slug', () => {
  it('lấy được bằng cả id và slug', async () => {
    const product = await createProduct({ name: 'Tra Cứu Slug' });

    const byId = await request(app).get(api(`/products/${product.id}`));
    expect(byId.status).toBe(200);

    const bySlug = await request(app).get(api(`/products/${byId.body.data.slug}`));
    expect(bySlug.body.data.id).toBe(product.id);
  });

  it('product INACTIVE: khách 404, admin 200', async () => {
    const product = await createProduct({ name: 'Bị ẩn', status: 'INACTIVE' });

    expect((await request(app).get(api(`/products/${product.id}`))).status).toBe(404);
    expect(
      (await request(app).get(api(`/products/${product.id}`)).set(admin.authHeader)).status
    ).toBe(200);
  });

  it('khách không thấy variant INACTIVE', async () => {
    const product = await createProduct({
      name: 'Có variant ẩn',
      variants: [
        { sku: 'VIS-100', volume_ml: 100, price: 100000, stock: 1 },
        { sku: 'HID-50', volume_ml: 50, price: 50000, status: 'INACTIVE', stock: 1 },
      ],
    });

    const publicRes = await request(app).get(api(`/products/${product.id}`));
    expect(publicRes.body.data.variants.map((v) => v.sku)).toEqual(['VIS-100']);

    const adminRes = await request(app).get(api(`/products/${product.id}`)).set(admin.authHeader);
    expect(adminRes.body.data.variants).toHaveLength(2);
  });
});

describe('Variants', () => {
  it('thêm variant vào product', async () => {
    const product = await createProduct({ variants: [] });

    const res = await request(app)
      .post(api(`/products/${product.id}/variants`))
      .set(admin.authHeader)
      .send({ sku: 'NEW-VAR-60', volume_ml: 60, price: 3250000 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ sku: 'NEW-VAR-60', volume_ml: 60, stock_quantity: 0 });
  });

  it('SKU trùng → 409; cùng product trùng volume → 409', async () => {
    const product = await createProduct({
      variants: [{ sku: 'DUP-100', volume_ml: 100, price: 100000 }],
    });

    const dupSku = await request(app)
      .post(api(`/products/${product.id}/variants`))
      .set(admin.authHeader)
      .send({ sku: 'DUP-100', volume_ml: 50, price: 100000 });
    expect(dupSku.status).toBe(409);
    expect(dupSku.body.message).toBe('SKU already exists');

    const dupVolume = await request(app)
      .post(api(`/products/${product.id}/variants`))
      .set(admin.authHeader)
      .send({ sku: 'OTHER-100', volume_ml: 100, price: 100000 });
    expect(dupVolume.status).toBe(409);
    expect(dupVolume.body.message).toContain('same volume');
  });

  it('không sửa được stock_quantity qua endpoint variant', async () => {
    const product = await createProduct({
      variants: [{ sku: 'NOSTOCK-100', volume_ml: 100, price: 100000, stock: 7 }],
    });
    const variantId = product.variants[0].id;

    const res = await request(app)
      .put(api(`/variants/${variantId}`))
      .set(admin.authHeader)
      .send({ stock_quantity: 999, price: 120000 });

    expect(res.status).toBe(200);
    expect(res.body.data.stock_quantity).toBe(7);
    expect(Number(res.body.data.price)).toBe(120000);
  });

  it('sửa price thấp hơn sale_price hiện có → 400', async () => {
    const product = await createProduct({
      variants: [{ sku: 'SALE-100', volume_ml: 100, price: 200000, sale_price: 180000 }],
    });

    const res = await request(app)
      .put(api(`/variants/${product.variants[0].id}`))
      .set(admin.authHeader)
      .send({ price: 100000 });

    expect(res.status).toBe(400);
  });

  it('xóa variant đã có lịch sử kho → 409', async () => {
    const product = await createProduct({
      variants: [{ sku: 'HASTXN-100', volume_ml: 100, price: 100000, stock: 5 }],
    });

    const res = await request(app)
      .delete(api(`/variants/${product.variants[0].id}`))
      .set(admin.authHeader);

    expect(res.status).toBe(409);
  });

  it('xóa variant sạch (chưa nhập kho, chưa bán) → 200', async () => {
    const product = await createProduct({
      variants: [{ sku: 'CLEAN-100', volume_ml: 100, price: 100000, stock: 0 }],
    });

    const res = await request(app)
      .delete(api(`/variants/${product.variants[0].id}`))
      .set(admin.authHeader);

    expect(res.status).toBe(200);
  });
});

describe('Product images', () => {
  it('upload ảnh đầu tiên tự thành ảnh chính, file được ghi ra storage', async () => {
    const product = await createProduct({ name: 'Có ảnh' });

    const res = await request(app)
      .post(api(`/products/${product.id}/images`))
      .set(admin.authHeader)
      .attach('files', PNG_1X1, { filename: 'test.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].is_primary).toBe(true);

    const row = await prisma.productImage.findFirst({ where: { product_id: product.id } });
    expect(fs.existsSync(path.join(UPLOAD_ROOT, row.public_id))).toBe(true);
  });

  it('upload nhiều ảnh, đổi ảnh chính được', async () => {
    const product = await createProduct({ name: 'Nhiều ảnh' });

    const uploaded = await request(app)
      .post(api(`/products/${product.id}/images`))
      .set(admin.authHeader)
      .attach('files', PNG_1X1, { filename: 'a.png', contentType: 'image/png' })
      .attach('files', PNG_1X1, { filename: 'b.png', contentType: 'image/png' });

    expect(uploaded.body.data).toHaveLength(2);

    const second = uploaded.body.data.find((image) => !image.is_primary);
    const res = await request(app)
      .patch(api(`/products/${product.id}/images/${second.id}/primary`))
      .set(admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.filter((image) => image.is_primary)).toHaveLength(1);
    expect(res.body.data.find((image) => image.is_primary).id).toBe(second.id);
  });

  it('xóa ảnh chính thì ảnh còn lại được đẩy lên làm ảnh chính, file bị xóa khỏi disk', async () => {
    const product = await createProduct({ name: 'Xóa ảnh chính' });
    const uploaded = await request(app)
      .post(api(`/products/${product.id}/images`))
      .set(admin.authHeader)
      .attach('files', PNG_1X1, { filename: 'a.png', contentType: 'image/png' })
      .attach('files', PNG_1X1, { filename: 'b.png', contentType: 'image/png' });

    const primary = uploaded.body.data.find((image) => image.is_primary);
    const row = await prisma.productImage.findUnique({ where: { id: primary.id } });

    const res = await request(app)
      .delete(api(`/products/${product.id}/images/${primary.id}`))
      .set(admin.authHeader);
    expect(res.status).toBe(200);

    expect(fs.existsSync(path.join(UPLOAD_ROOT, row.public_id))).toBe(false);

    const remaining = await prisma.productImage.findMany({ where: { product_id: product.id } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].is_primary).toBe(true);
  });

  it('file không phải ảnh raster → 400, không ghi DB', async () => {
    const product = await createProduct({ name: 'File sai' });

    const res = await request(app)
      .post(api(`/products/${product.id}/images`))
      .set(admin.authHeader)
      .attach('files', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), {
        filename: 'evil.svg',
        contentType: 'image/svg+xml',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Invalid file type');
    expect(await prisma.productImage.count({ where: { product_id: product.id } })).toBe(0);
  });

  it('không gửi file → 400', async () => {
    const product = await createProduct({ name: 'Không file' });
    const res = await request(app)
      .post(api(`/products/${product.id}/images`))
      .set(admin.authHeader);

    expect(res.status).toBe(400);
  });

  it('CUSTOMER upload ảnh → 403', async () => {
    const product = await createProduct({ name: 'Khách upload' });
    const res = await request(app)
      .post(api(`/products/${product.id}/images`))
      .set(customer.authHeader)
      .attach('files', PNG_1X1, { filename: 'a.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
  });

  it('ảnh của product khác → 404', async () => {
    const productA = await createProduct({ name: 'A' });
    const productB = await createProduct({ name: 'B' });

    const uploaded = await request(app)
      .post(api(`/products/${productA.id}/images`))
      .set(admin.authHeader)
      .attach('files', PNG_1X1, { filename: 'a.png', contentType: 'image/png' });

    const res = await request(app)
      .delete(api(`/products/${productB.id}/images/${uploaded.body.data[0].id}`))
      .set(admin.authHeader);

    expect(res.status).toBe(404);
  });
});
