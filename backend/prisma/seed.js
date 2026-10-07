'use strict';

/**
 * Seed idempotent — chạy nhiều lần không nhân bản dữ liệu (dùng upsert theo unique key).
 * Mật khẩu lấy từ env SEED_PASSWORD, không hard-code.
 */

const bcrypt = require('bcryptjs');
const env = require('../src/config/env');
const { prisma } = require('../src/config/database');
const { slugify } = require('../src/utils/slug');
const { writePlaceholderImage } = require('./placeholderImage');

const RESOURCES = [
  'user',
  'role',
  'permission',
  'brand',
  'category',
  'product',
  'variant',
  'image',
  'inventory',
  'customer',
  'cart',
  'order',
  'promotion',
  'review',
  'report',
];

const ACTIONS = ['view', 'create', 'update', 'delete'];

/** Permission chỉ STAFF không được chạm (CLAUDE.md §5). */
const ADMIN_ONLY_PREFIXES = ['user.', 'role.', 'permission.'];
const ADMIN_ONLY_CODES = ['promotion.delete', 'inventory.adjust', 'review.delete', 'order.return'];

function buildPermissionCodes() {
  const codes = [];
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      codes.push(`${resource}.${action}`);
    }
  }
  codes.push('inventory.import', 'inventory.export', 'inventory.adjust');
  codes.push('order.update_status', 'order.return', 'order.cancel');
  return [...new Set(codes)];
}

function isAdminOnly(code) {
  return ADMIN_ONLY_PREFIXES.some((prefix) => code.startsWith(prefix)) || ADMIN_ONLY_CODES.includes(code);
}

const BRANDS = [
  { name: 'Dior', description: 'Thương hiệu nước hoa cao cấp đến từ Pháp.' },
  { name: 'Chanel', description: 'Nhà mốt Pháp với các dòng nước hoa kinh điển.' },
  { name: 'Versace', description: 'Thương hiệu Ý, hương thơm trẻ trung và nổi bật.' },
];

const CATEGORIES = [
  { name: 'Nước hoa nam', description: 'Hương thơm dành cho nam giới.' },
  { name: 'Nước hoa nữ', description: 'Hương thơm dành cho nữ giới.' },
  { name: 'Unisex', description: 'Hương thơm dùng được cho cả nam và nữ.' },
  { name: 'Gift Set', description: 'Bộ quà tặng nhiều sản phẩm.' },
  { name: 'Mini', description: 'Chai dung tích nhỏ, tiện mang theo.' },
];

const PRODUCTS = [
  {
    name: 'Dior Sauvage Eau de Parfum',
    brand: 'Dior',
    category: 'Nước hoa nam',
    gender: 'MALE',
    origin: 'Pháp',
    concentration: 'EDP',
    fragrance_family: 'Woody Aromatic',
    description: 'Hương gỗ thơm nam tính với tiêu Sichuan và hoắc hương.',
    skuPrefix: 'DIOR-SAUV-EDP',
    variants: [
      { volume_ml: 30, price: 2150000, stock: 40 },
      { volume_ml: 60, price: 3250000, stock: 25 },
      { volume_ml: 100, price: 4150000, sale_price: 3890000, stock: 18 },
      { volume_ml: 200, price: 6250000, stock: 4 },
    ],
  },
  {
    name: 'Dior Miss Dior Blooming Bouquet',
    brand: 'Dior',
    category: 'Nước hoa nữ',
    gender: 'FEMALE',
    origin: 'Pháp',
    concentration: 'EDT',
    fragrance_family: 'Floral',
    description: 'Hương hoa mẫu đơn và hồng Damascus dịu nhẹ.',
    skuPrefix: 'DIOR-MDBB-EDT',
    variants: [
      { volume_ml: 30, price: 1950000, stock: 30 },
      { volume_ml: 50, price: 2850000, stock: 22 },
      { volume_ml: 100, price: 4050000, stock: 3 },
    ],
  },
  {
    name: 'Chanel Bleu de Chanel Eau de Parfum',
    brand: 'Chanel',
    category: 'Nước hoa nam',
    gender: 'MALE',
    origin: 'Pháp',
    concentration: 'EDP',
    fragrance_family: 'Woody Aromatic',
    description: 'Hương gỗ tuyết tùng kết hợp bạc hà và gừng.',
    skuPrefix: 'CHANEL-BLEU-EDP',
    variants: [
      { volume_ml: 50, price: 3450000, stock: 20 },
      { volume_ml: 100, price: 4650000, sale_price: 4390000, stock: 15 },
      { volume_ml: 150, price: 6150000, stock: 5 },
    ],
  },
  {
    name: 'Chanel Coco Mademoiselle',
    brand: 'Chanel',
    category: 'Nước hoa nữ',
    gender: 'FEMALE',
    origin: 'Pháp',
    concentration: 'EDP',
    fragrance_family: 'Oriental Floral',
    description: 'Hương cam bergamot, hoa nhài và hoắc hương sang trọng.',
    skuPrefix: 'CHANEL-COCO-EDP',
    variants: [
      { volume_ml: 35, price: 2750000, stock: 26 },
      { volume_ml: 50, price: 3950000, stock: 14 },
      { volume_ml: 100, price: 5450000, stock: 2 },
    ],
  },
  {
    name: 'Versace Eros Eau de Toilette',
    brand: 'Versace',
    category: 'Unisex',
    gender: 'UNISEX',
    origin: 'Ý',
    concentration: 'EDT',
    fragrance_family: 'Aromatic Fougere',
    description: 'Hương bạc hà, táo xanh và vanilla ngọt ấm.',
    skuPrefix: 'VERSACE-EROS-EDT',
    variants: [
      { volume_ml: 30, price: 1150000, stock: 50 },
      { volume_ml: 50, price: 1650000, stock: 35 },
      { volume_ml: 100, price: 2250000, sale_price: 1990000, stock: 28 },
    ],
  },
];

async function seedRolesAndPermissions() {
  const roleDefs = [
    { name: 'ADMIN', description: 'Toàn quyền hệ thống' },
    { name: 'STAFF', description: 'Nhân viên: sản phẩm, tồn kho, đơn hàng' },
    { name: 'CUSTOMER', description: 'Khách hàng' },
  ];

  const roles = {};
  for (const def of roleDefs) {
    roles[def.name] = await prisma.role.upsert({
      where: { name: def.name },
      update: { description: def.description, is_system: true },
      create: { ...def, is_system: true },
    });
  }

  const codes = buildPermissionCodes();
  const permissions = [];
  for (const code of codes) {
    permissions.push(
      await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      })
    );
  }

  // ADMIN: tất cả. STAFF: tất cả trừ admin-only.
  const grants = [
    ...permissions.map((p) => ({ role_id: roles.ADMIN.id, permission_id: p.id })),
    ...permissions
      .filter((p) => !isAdminOnly(p.code))
      .map((p) => ({ role_id: roles.STAFF.id, permission_id: p.id })),
  ];

  await prisma.rolePermission.createMany({ data: grants, skipDuplicates: true });

  return { roles, permissionCount: permissions.length };
}

async function seedUsers(roles) {
  if (!env.SEED_PASSWORD) {
    throw new Error('SEED_PASSWORD is required to seed users. Set it in backend/.env');
  }
  const passwordHash = await bcrypt.hash(env.SEED_PASSWORD, 10);

  const userDefs = [
    { email: 'admin@perfume.local', full_name: 'Quản trị viên', phone: '0900000001', role: 'ADMIN' },
    { email: 'staff@perfume.local', full_name: 'Nhân viên bán hàng', phone: '0900000002', role: 'STAFF' },
    {
      email: 'customer@perfume.local',
      full_name: 'Khách hàng demo',
      phone: '0900000003',
      role: 'CUSTOMER',
      address: '12 Nguyễn Huệ, Quận 1, TP.HCM',
    },
  ];

  const users = {};
  for (const def of userDefs) {
    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: { full_name: def.full_name, phone: def.phone, status: 'ACTIVE', deleted_at: null },
      create: {
        email: def.email,
        password_hash: passwordHash,
        full_name: def.full_name,
        phone: def.phone,
      },
    });

    await prisma.userRole.createMany({
      data: [{ user_id: user.id, role_id: roles[def.role].id }],
      skipDuplicates: true,
    });

    // Role CUSTOMER: tạo profile nghiệp vụ + cart (OD-2).
    if (def.role === 'CUSTOMER') {
      const customer = await prisma.customer.upsert({
        where: { user_id: user.id },
        update: { address: def.address },
        create: { user_id: user.id, address: def.address },
      });
      await prisma.cart.upsert({
        where: { customer_id: customer.id },
        update: {},
        create: { customer_id: customer.id },
      });
    }

    users[def.role] = user;
  }
  return users;
}

async function seedCatalog(adminUserId) {
  const brands = {};
  for (const def of BRANDS) {
    const slug = slugify(def.name);
    brands[def.name] = await prisma.brand.upsert({
      where: { slug },
      update: { name: def.name, description: def.description, deleted_at: null },
      create: { name: def.name, slug, description: def.description },
    });
  }

  const categories = {};
  for (const def of CATEGORIES) {
    const slug = slugify(def.name);
    categories[def.name] = await prisma.category.upsert({
      where: { slug },
      update: { name: def.name, description: def.description, deleted_at: null },
      create: { name: def.name, slug, description: def.description },
    });
  }

  let variantCount = 0;
  let imageCount = 0;
  for (const def of PRODUCTS) {
    const slug = slugify(def.name);
    const product = await prisma.product.upsert({
      where: { slug },
      update: {
        name: def.name,
        brand_id: brands[def.brand].id,
        category_id: categories[def.category].id,
        gender: def.gender,
        origin: def.origin,
        concentration: def.concentration,
        fragrance_family: def.fragrance_family,
        description: def.description,
        deleted_at: null,
      },
      create: {
        name: def.name,
        slug,
        brand_id: brands[def.brand].id,
        category_id: categories[def.category].id,
        gender: def.gender,
        origin: def.origin,
        concentration: def.concentration,
        fragrance_family: def.fragrance_family,
        description: def.description,
      },
    });

    for (const v of def.variants) {
      const sku = `${def.skuPrefix}-${v.volume_ml}`;
      const existing = await prisma.productVariant.findUnique({ where: { sku } });

      if (existing) {
        // Không ghi đè stock của variant đã tồn tại — stock chỉ đổi qua module inventory.
        await prisma.productVariant.update({
          where: { sku },
          data: { price: v.price, sale_price: v.sale_price ?? null },
        });
      } else {
        // Variant mới: tạo với stock 0 rồi nhập kho qua transaction IMPORT, để
        // SUM(inventory_transactions.quantity) luôn khớp stock_quantity.
        const variant = await prisma.productVariant.create({
          data: {
            product_id: product.id,
            sku,
            volume_ml: v.volume_ml,
            price: v.price,
            sale_price: v.sale_price ?? null,
          },
        });

        await prisma.$transaction([
          prisma.productVariant.update({
            where: { id: variant.id },
            data: { stock_quantity: v.stock },
          }),
          prisma.inventoryTransaction.create({
            data: {
              variant_id: variant.id,
              type: 'IMPORT',
              quantity: v.stock,
              stock_before: 0,
              stock_after: v.stock,
              note: 'Nhập kho khởi tạo (seed)',
              created_by: adminUserId,
            },
          }),
        ]);
      }
      variantCount += 1;
    }

    // Ảnh placeholder tự sinh (W3): 1 ảnh / variant, ảnh của variant nhỏ nhất
    // làm ảnh chính. Không dùng ảnh có bản quyền từ site khác.
    const existingImages = await prisma.productImage.count({ where: { product_id: product.id } });
    if (existingImages === 0) {
      const rows = [];
      for (const [index, v] of def.variants.entries()) {
        const sku = `${def.skuPrefix}-${v.volume_ml}`;
        const image = await writePlaceholderImage({
          brandName: def.brand,
          productName: def.name,
          volumeMl: v.volume_ml,
          sku,
        });
        rows.push({
          product_id: product.id,
          image_url: image.url,
          public_id: image.public_id,
          is_primary: index === 0,
          sort_order: index,
        });
      }
      await prisma.productImage.createMany({ data: rows });
      imageCount += rows.length;
    }
  }

  return {
    brandCount: Object.keys(brands).length,
    categoryCount: Object.keys(categories).length,
    productCount: PRODUCTS.length,
    variantCount,
    imageCount,
  };
}

async function seedPromotions() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 3, 0, 23, 59, 59);

  const defs = [
    {
      code: 'WELCOME10',
      name: 'Giảm 10% cho đơn đầu tiên',
      discount_type: 'PERCENTAGE',
      discount_value: 10,
      minimum_order_value: 1000000,
      max_discount: 500000,
      usage_limit: 100,
      per_customer_limit: 1,
    },
    {
      code: 'FREESHIP200K',
      name: 'Giảm 200.000đ cho đơn từ 3.000.000đ',
      discount_type: 'FIXED',
      discount_value: 200000,
      minimum_order_value: 3000000,
      max_discount: null,
      usage_limit: 50,
      per_customer_limit: 1,
    },
  ];

  for (const def of defs) {
    await prisma.promotion.upsert({
      where: { code: def.code },
      update: { ...def, start_date: start, end_date: end },
      create: { ...def, start_date: start, end_date: end },
    });
  }
  return defs.length;
}

async function main() {
  // eslint-disable-next-line no-console
  const log = console.log;

  const { roles, permissionCount } = await seedRolesAndPermissions();
  log(`[seed] roles: 3, permissions: ${permissionCount}`);

  const users = await seedUsers(roles);
  log('[seed] users: admin@perfume.local, staff@perfume.local, customer@perfume.local');

  const catalog = await seedCatalog(users.ADMIN.id);
  log(
    `[seed] brands: ${catalog.brandCount}, categories: ${catalog.categoryCount}, products: ${catalog.productCount}, variants: ${catalog.variantCount}, images: ${catalog.imageCount}`
  );

  const promotionCount = await seedPromotions();
  log(`[seed] promotions: ${promotionCount}`);
  log('[seed] done');
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[seed] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
