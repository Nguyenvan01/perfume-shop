# Implementation Plan — Perfume Shop Management System

> Nguồn sự thật nghiệp vụ: `CLAUDE.md`. File này chỉ cụ thể hoá *interface* và *thứ tự thi công* để Claude (frontend) và Codex (backend) làm song song mà không phải đoán.
> Trạng thái: **PLANNING — chưa implement.** Cần approve Open Decisions (§6) trước khi vào Wave 1.

## 0. Phân vai & ranh giới file

| Agent | Sở hữu | Không được sửa |
|---|---|---|
| **Claude** (`agent-claude`) | `frontend/**`, `implementation_plan.md`, `task.md`, review + integration, `README.md` | `backend/**` |
| **Codex** (`agent-codex`) | `backend/**` (Express + Prisma + MySQL), `backend/tests/**`, `backend/prisma/**` | `frontend/**` |

Quy tắc chống xung đột:
- Hai agent **không bao giờ** cùng sửa một file. Ranh giới là thư mục `backend/` vs `frontend/`.
- File dùng chung duy nhất: `implementation_plan.md` + `task.md` (chỉ Claude sửa). Codex muốn đổi contract → báo Claude, Claude cập nhật plan.
- Contract trong §2 là **hợp đồng cứng**. Backend lệch contract = bug của backend; frontend code theo contract này.
- Branch: `feature/be-<scope>` (Codex), `feature/fe-<scope>` (Claude). Không commit trực tiếp `main`.

Hiện trạng repo (đã khảo sát):
- Chưa có `backend/`, `frontend/`. Root chỉ có tài liệu + `.agents/skills`, `orca/`, `lessons/`, `learning-records/` (không đọc, không liên quan).
- `MISSION.md`, `docs/*.md`, `package-lock.json` (`vibecoding-erp`) thuộc **dự án song song khác** (Next.js + Supabase). → Xem Open Decision OD-1.
- Local có: Node 22.16, npm 10.9, MySQL 9.5 (Homebrew), Docker 29.7.

---

## 1. Prisma schema đầy đủ

File: `backend/prisma/schema.prisma`. MySQL provider. Tiền dùng `Decimal(12,2)`. Mọi bảng có `created_at`/`updated_at` trừ bảng join.

```prisma
generator client { provider = "prisma-client-js" }
datasource db   { provider = "mysql"; url = env("DATABASE_URL") }

// ─────────── Enums ───────────
enum Status          { ACTIVE INACTIVE }            // dùng cho brand/category/product/variant/promotion
enum UserStatus      { ACTIVE LOCKED }
enum Gender          { MALE FEMALE UNISEX }
enum Concentration   { EDC EDT EDP PARFUM }
enum InventoryType   { IMPORT EXPORT SALE RETURN ADJUSTMENT }
enum OrderStatus     { PENDING CONFIRMED PACKING SHIPPING COMPLETED CANCELLED RETURNED }
enum PaymentMethod   { COD BANK_TRANSFER }
enum PaymentStatus   { UNPAID PAID REFUNDED }
enum DiscountType    { PERCENTAGE FIXED }

// ─────────── Identity & RBAC ───────────
model User {
  id            Int        @id @default(autoincrement())
  email         String     @unique @db.VarChar(191)
  password_hash String     @db.VarChar(255)
  full_name     String     @db.VarChar(120)
  phone         String?    @db.VarChar(20)
  status        UserStatus @default(ACTIVE)
  deleted_at    DateTime?
  created_at    DateTime   @default(now())
  updated_at    DateTime   @updatedAt

  user_roles     UserRole[]
  customer       Customer?
  refresh_tokens RefreshToken[]
  reset_tokens   PasswordResetToken[]
  inv_txns       InventoryTransaction[] @relation("InvCreatedBy")

  @@map("users")
}

model Role {
  id          Int      @id @default(autoincrement())
  name        String   @unique @db.VarChar(50)   // ADMIN | STAFF | CUSTOMER
  description String?  @db.VarChar(255)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  user_roles       UserRole[]
  role_permissions RolePermission[]

  @@map("roles")
}

model Permission {
  id          Int      @id @default(autoincrement())
  code        String   @unique @db.VarChar(80)   // vd "product.create", "order.update_status"
  description String?  @db.VarChar(255)
  created_at  DateTime @default(now())

  role_permissions RolePermission[]

  @@map("permissions")
}

model UserRole {
  user_id Int
  role_id Int
  user    User @relation(fields: [user_id], references: [id], onDelete: Cascade)
  role    Role @relation(fields: [role_id], references: [id], onDelete: Cascade)

  @@id([user_id, role_id])
  @@map("user_roles")
}

model RolePermission {
  role_id       Int
  permission_id Int
  role       Role       @relation(fields: [role_id], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permission_id], references: [id], onDelete: Cascade)

  @@id([role_id, permission_id])
  @@map("role_permissions")
}

model RefreshToken {
  id         Int      @id @default(autoincrement())
  user_id    Int
  token_hash String   @unique @db.VarChar(255)
  expires_at DateTime
  revoked_at DateTime?
  created_at DateTime @default(now())
  user       User     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@map("refresh_tokens")
}

model PasswordResetToken {
  id         Int      @id @default(autoincrement())
  user_id    Int
  token_hash String   @unique @db.VarChar(255)
  expires_at DateTime
  used_at    DateTime?
  created_at DateTime @default(now())
  user       User     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@map("password_reset_tokens")
}

// Customer = profile nghiệp vụ 1-1 của User có role CUSTOMER (xem OD-2)
model Customer {
  id             Int      @id @default(autoincrement())
  user_id        Int      @unique
  address        String?  @db.VarChar(255)
  total_orders   Int      @default(0)        // denormalized, cập nhật khi order COMPLETED
  total_spending Decimal  @default(0) @db.Decimal(12, 2)
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt

  user    User    @relation(fields: [user_id], references: [id], onDelete: Cascade)
  cart    Cart?
  orders  Order[]
  reviews Review[]
  promotion_usages PromotionUsage[]

  @@map("customers")
}

// ─────────── Catalog ───────────
model Brand {
  id          Int      @id @default(autoincrement())
  name        String   @db.VarChar(120)
  slug        String   @unique @db.VarChar(140)
  description String?  @db.Text
  logo_url    String?  @db.VarChar(500)
  status      Status   @default(ACTIVE)
  deleted_at  DateTime?
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  products Product[]
  @@map("brands")
}

model Category {
  id          Int      @id @default(autoincrement())
  name        String   @db.VarChar(120)
  slug        String   @unique @db.VarChar(140)
  description String?  @db.Text
  status      Status   @default(ACTIVE)
  deleted_at  DateTime?
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  products Product[]
  @@map("categories")
}

model Product {
  id               Int           @id @default(autoincrement())
  name             String        @db.VarChar(200)
  slug             String        @unique @db.VarChar(220)
  brand_id         Int
  category_id      Int
  gender           Gender        @default(UNISEX)
  origin           String?       @db.VarChar(100)
  concentration    Concentration @default(EDP)
  fragrance_family String?       @db.VarChar(120)
  description      String?       @db.Text
  status           Status        @default(ACTIVE)
  deleted_at       DateTime?
  created_at       DateTime      @default(now())
  updated_at       DateTime      @updatedAt

  brand    Brand          @relation(fields: [brand_id], references: [id])
  category Category       @relation(fields: [category_id], references: [id])
  variants ProductVariant[]
  images   ProductImage[]
  reviews  Review[]

  @@index([brand_id])
  @@index([category_id])
  @@index([status])
  @@map("products")
}

model ProductVariant {
  id             Int      @id @default(autoincrement())
  product_id     Int
  sku            String   @unique @db.VarChar(64)
  volume_ml      Int
  price          Decimal  @db.Decimal(12, 2)
  sale_price     Decimal? @db.Decimal(12, 2)
  stock_quantity Int      @default(0)
  status         Status   @default(ACTIVE)
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt

  product    Product                @relation(fields: [product_id], references: [id], onDelete: Cascade)
  inv_txns   InventoryTransaction[]
  cart_items CartItem[]
  order_details OrderDetail[]

  @@unique([product_id, volume_ml])
  @@index([product_id])
  @@map("product_variants")
}

model ProductImage {
  id          Int      @id @default(autoincrement())
  product_id  Int
  image_url   String   @db.VarChar(500)
  public_id   String?  @db.VarChar(255)   // Cloudinary public_id để xoá
  is_primary  Boolean  @default(false)
  sort_order  Int      @default(0)
  created_at  DateTime @default(now())

  product Product @relation(fields: [product_id], references: [id], onDelete: Cascade)
  @@index([product_id])
  @@map("product_images")
}

// ─────────── Inventory ───────────
model InventoryTransaction {
  id           Int           @id @default(autoincrement())
  variant_id   Int
  type         InventoryType
  quantity     Int                               // dấu + / − theo type
  stock_before Int
  stock_after  Int
  reference    String?       @db.VarChar(64)     // vd "ORDER:123"
  note         String?       @db.VarChar(255)
  created_by   Int?
  created_at   DateTime      @default(now())

  variant ProductVariant @relation(fields: [variant_id], references: [id])
  creator User?          @relation("InvCreatedBy", fields: [created_by], references: [id])

  @@index([variant_id, created_at])
  @@index([type])
  @@map("inventory_transactions")
}

// ─────────── Cart ───────────
model Cart {
  id          Int      @id @default(autoincrement())
  customer_id Int      @unique
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  customer Customer   @relation(fields: [customer_id], references: [id], onDelete: Cascade)
  items    CartItem[]
  @@map("carts")
}

model CartItem {
  id         Int      @id @default(autoincrement())
  cart_id    Int
  variant_id Int
  quantity   Int
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  cart    Cart           @relation(fields: [cart_id], references: [id], onDelete: Cascade)
  variant ProductVariant @relation(fields: [variant_id], references: [id])

  @@unique([cart_id, variant_id])
  @@map("cart_items")
}

// ─────────── Order ───────────
model Order {
  id               Int         @id @default(autoincrement())
  order_code       String      @unique @db.VarChar(32)   // vd "PS20261006-0001"
  customer_id      Int
  status           OrderStatus @default(PENDING)
  receiver_name    String      @db.VarChar(120)
  receiver_phone   String      @db.VarChar(20)
  shipping_address String      @db.VarChar(255)
  note             String?     @db.VarChar(255)
  subtotal         Decimal     @db.Decimal(12, 2)
  discount_amount  Decimal     @default(0) @db.Decimal(12, 2)
  shipping_fee     Decimal     @default(0) @db.Decimal(12, 2)
  total_amount     Decimal     @db.Decimal(12, 2)
  promotion_id     Int?
  promotion_code   String?     @db.VarChar(50)           // snapshot
  cancelled_reason String?     @db.VarChar(255)
  confirmed_at     DateTime?
  completed_at     DateTime?
  created_at       DateTime    @default(now())
  updated_at       DateTime    @updatedAt

  customer  Customer        @relation(fields: [customer_id], references: [id])
  promotion Promotion?      @relation(fields: [promotion_id], references: [id])
  details   OrderDetail[]
  payment   Payment?
  usages    PromotionUsage[]

  @@index([customer_id])
  @@index([status, created_at])
  @@map("orders")
}

model OrderDetail {
  id           Int     @id @default(autoincrement())
  order_id     Int
  variant_id   Int
  product_name String  @db.VarChar(200)   // snapshot
  sku          String  @db.VarChar(64)    // snapshot
  volume_ml    Int                        // snapshot
  unit_price   Decimal @db.Decimal(12, 2) // snapshot
  quantity     Int
  line_total   Decimal @db.Decimal(12, 2)

  order   Order          @relation(fields: [order_id], references: [id], onDelete: Cascade)
  variant ProductVariant @relation(fields: [variant_id], references: [id])

  @@index([order_id])
  @@map("order_details")
}

model Payment {
  id         Int           @id @default(autoincrement())
  order_id   Int           @unique
  method     PaymentMethod @default(COD)
  status     PaymentStatus @default(UNPAID)
  amount     Decimal       @db.Decimal(12, 2)
  paid_at    DateTime?
  created_at DateTime      @default(now())
  updated_at DateTime      @updatedAt

  order Order @relation(fields: [order_id], references: [id], onDelete: Cascade)
  @@map("payments")
}

// ─────────── Promotion ───────────
model Promotion {
  id                  Int          @id @default(autoincrement())
  code                String       @unique @db.VarChar(50)
  name                String       @db.VarChar(150)
  discount_type       DiscountType
  discount_value      Decimal      @db.Decimal(12, 2)
  minimum_order_value Decimal      @default(0) @db.Decimal(12, 2)
  max_discount        Decimal?     @db.Decimal(12, 2)
  start_date          DateTime
  end_date            DateTime
  usage_limit         Int?                                  // null = không giới hạn
  per_customer_limit  Int          @default(1)
  used_count          Int          @default(0)
  status              Status       @default(ACTIVE)
  created_at          DateTime     @default(now())
  updated_at          DateTime     @updatedAt

  orders Order[]
  usages PromotionUsage[]
  @@map("promotions")
}

model PromotionUsage {
  id              Int      @id @default(autoincrement())
  promotion_id    Int
  customer_id     Int
  order_id        Int
  discount_amount Decimal  @db.Decimal(12, 2)
  created_at      DateTime @default(now())

  promotion Promotion @relation(fields: [promotion_id], references: [id])
  customer  Customer  @relation(fields: [customer_id], references: [id])
  order     Order     @relation(fields: [order_id], references: [id], onDelete: Cascade)

  @@unique([promotion_id, order_id])
  @@index([promotion_id, customer_id])
  @@map("promotion_usages")
}

// ─────────── Review ───────────
model Review {
  id          Int      @id @default(autoincrement())
  product_id  Int
  customer_id Int
  order_id    Int?                           // đơn COMPLETED chứng minh đã mua
  rating      Int                            // 1..5, validate ở service
  comment     String?  @db.Text
  is_hidden   Boolean  @default(false)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  product  Product  @relation(fields: [product_id], references: [id], onDelete: Cascade)
  customer Customer @relation(fields: [customer_id], references: [id], onDelete: Cascade)

  @@unique([product_id, customer_id])
  @@index([product_id, is_hidden])
  @@map("reviews")
}
```

### 1.1 Sai khác so với bản draft (đã implement ở W1)

Schema thực tế có thêm so với §1 ban đầu — ghi lại để plan vẫn là nguồn sự thật:

| Thêm | Lý do |
|---|---|
| `Role.is_system` (Boolean) | Chặn xoá/đổi tên 3 role lõi ADMIN/STAFF/CUSTOMER (§2.3 `DELETE /roles/:id` → 409) |
| `Brand.logo_public_id` | Xoá logo trên storage provider khi đổi/xoá brand, song song `ProductImage.public_id` |
| Index phụ: `users.status`, `brands.status`, `categories.status`, `products.gender`, `product_variants.stock_quantity`, `promotions(status,start_date,end_date)`, FK index cho các bảng join | Phục vụ filter/sort đã khai báo ở §2 (low-stock, filter theo status/gender, promotion active) |
| `datasource.shadowDatabaseUrl` | User `perfume` không có quyền `CREATE DATABASE`; shadow DB cấp sẵn là `perfume_shop_shadow` (xem §5.1) |

Dependency chốt ở W1: `bcryptjs` (thay `bcrypt` — thuật toán giống, không cần native build), `zod` cho validation, `express-rate-limit` chuẩn bị cho W2.

---

### Seed (`backend/prisma/seed.js`)
- 3 roles: `ADMIN`, `STAFF`, `CUSTOMER`; permissions `<resource>.<action>` cho mọi resource; `role_permissions`: ADMIN = all, STAFF = all trừ `user.*`, `role.*`, `permission.*`, `promotion.delete`.
- Users: `admin@perfume.local`, `staff@perfume.local`, `customer@perfume.local` (password lấy từ env `SEED_PASSWORD`, không hard-code).
- 3 brands (Dior, Chanel, Versace), 5 categories (Nam, Nữ, Unisex, Gift Set, Mini), 5 products × 3–4 variants, mỗi variant 1 txn `IMPORT` + stock khớp, 2 promotions.
- Seed **idempotent** (dùng `upsert`), chạy lại không nhân bản dữ liệu.

---

## 2. API contract

Base: `/api/v1`. Mọi response bọc envelope:

```json
// success
{ "success": true, "message": "Success", "data": <T>, "meta": { "page":1, "limit":10, "total":0, "totalPages":0 } }
// error
{ "success": false, "message": "Validation failed", "errors": [ { "field":"email", "message":"Email is invalid" } ] }
```

`meta` chỉ có ở list endpoint. Error codes dùng chung:

| HTTP | Khi nào | `message` ví dụ |
|---|---|---|
| 400 | Validation fail | `Validation failed` (kèm `errors[]`) |
| 401 | Thiếu/sai/hết hạn token | `Unauthorized` / `Token expired` |
| 403 | Thiếu role/permission, hoặc truy cập resource của người khác | `Forbidden` |
| 404 | Không tìm thấy | `Product not found` |
| 409 | Conflict nghiệp vụ (slug/SKU/email trùng, chuyển status sai, stock không đủ) | `SKU already exists` |
| 422 | Rule nghiệp vụ fail có ngữ nghĩa riêng | `Insufficient stock` |
| 500 | Lỗi không lường trước | `Internal server error` |

Auth header: `Authorization: Bearer <accessToken>`. Access token TTL 15m, refresh 7d (xem OD-3).

**Query params chuẩn cho list:** `page` (default 1), `limit` (default 10, max 100), `sort` (vd `created_at:desc`), `q` (keyword), cộng filter riêng từng resource.

### Shared DTO shapes

```ts
BrandDTO    = { id, name, slug, description, logo_url, status, created_at, updated_at }
CategoryDTO = { id, name, slug, description, status, created_at, updated_at }
VariantDTO  = { id, product_id, sku, volume_ml, price, sale_price, stock_quantity, status }
ImageDTO    = { id, image_url, is_primary, sort_order }
ProductDTO  = { id, name, slug, gender, origin, concentration, fragrance_family, description, status,
                brand: {id,name,slug}, category: {id,name,slug},
                variants: VariantDTO[], images: ImageDTO[],
                price_range: { min, max }, total_stock, created_at, updated_at }
UserDTO     = { id, email, full_name, phone, status, roles: string[], created_at }   // KHÔNG có password_hash
CustomerDTO = { id, user_id, full_name, email, phone, address, status, total_orders, total_spending, created_at }
CartItemDTO = { id, variant_id, sku, product_id, product_name, volume_ml, image_url,
                unit_price, quantity, line_total, stock_quantity }
CartDTO     = { id, items: CartItemDTO[], subtotal, item_count }
OrderDetailDTO = { id, variant_id, product_name, sku, volume_ml, unit_price, quantity, line_total }
OrderDTO    = { id, order_code, status, customer: {id, full_name, phone, email},
                receiver_name, receiver_phone, shipping_address, note,
                subtotal, discount_amount, shipping_fee, total_amount, promotion_code,
                payment: { method, status, amount, paid_at } | null,
                details: OrderDetailDTO[], cancelled_reason,
                confirmed_at, completed_at, created_at, updated_at }
// list order trả OrderDTO nhưng bỏ `details` (chỉ có `item_count`)
PromotionDTO = { id, code, name, discount_type, discount_value, minimum_order_value, max_discount,
                 start_date, end_date, usage_limit, per_customer_limit, used_count, status }
InvTxnDTO   = { id, variant: {id, sku, product_name, volume_ml}, type, quantity,
                stock_before, stock_after, reference, note,
                created_by: {id, full_name} | null, created_at }
ReviewDTO   = { id, product_id, rating, comment, is_hidden,
                customer: { id, full_name }, created_at }
```

Money trả về dạng **string** (Decimal serialize), vd `"1850000.00"`. Frontend tự format. Ngày tháng ISO-8601 UTC.

### 2.1 Health — M1

| Method | Path | Role | Request | Response 200 |
|---|---|---|---|---|
| GET | `/health` | public | — | `{ status:"ok", db:"up", uptime, version }` |

### 2.2 Auth — M3 (`/auth`)

| Method | Path | Role | Request body | Response `data` | Errors |
|---|---|---|---|---|---|
| POST | `/auth/register` | public | `{ email, password, full_name, phone?, address? }` | `{ user: UserDTO, accessToken, refreshToken }` | 400 validation; 409 `Email already registered` |
| POST | `/auth/login` | public | `{ email, password }` | `{ user: UserDTO, accessToken, refreshToken }` | 401 `Invalid credentials` (TC02); 403 `Account is locked` |
| POST | `/auth/refresh` | public | `{ refreshToken }` | `{ accessToken, refreshToken }` | 401 `Invalid or expired refresh token` |
| POST | `/auth/logout` | any auth | `{ refreshToken }` | `null` | 401 |
| GET | `/auth/me` | any auth | — | `UserDTO & { address?, permissions: string[] }` | 401 |
| PUT | `/auth/me` | any auth | `{ full_name?, phone?, address? }` | `UserDTO` | 400, 401 |
| POST | `/auth/change-password` | any auth | `{ current_password, new_password }` | `null` | 400; 401 `Current password is incorrect` |
| POST | `/auth/forgot-password` | public | `{ email }` | `null` (luôn 200, không tiết lộ email tồn tại) | 400 |
| POST | `/auth/reset-password` | public | `{ token, new_password }` | `null` | 400; 410 `Reset token expired or used` |

Password rule: ≥ 8 ký tự, có chữ + số. `password_hash` **không bao giờ** xuất hiện trong response.

### 2.3 Users / Roles / Permissions — M3 (ADMIN only → STAFF gọi = 403, TC09)

| Method | Path | Role | Request | Response |
|---|---|---|---|---|
| GET | `/users` | ADMIN | `?page&limit&q&role&status` | `UserDTO[]` + meta |
| GET | `/users/:id` | ADMIN | — | `UserDTO` |
| POST | `/users` | ADMIN | `{ email, password, full_name, phone?, role_ids:number[] }` | `UserDTO` (201) |
| PUT | `/users/:id` | ADMIN | `{ full_name?, phone?, role_ids? }` | `UserDTO` |
| PATCH | `/users/:id/status` | ADMIN | `{ status: "ACTIVE"\|"LOCKED" }` | `UserDTO` |
| PATCH | `/users/:id/reset-password` | ADMIN | `{ new_password }` | `null` |
| DELETE | `/users/:id` | ADMIN | — | `null` (soft delete; không cho tự xoá chính mình → 409) |
| GET | `/roles` | ADMIN | — | `{ id, name, description, permissions: string[] }[]` |
| POST | `/roles` | ADMIN | `{ name, description?, permission_ids: number[] }` | role (201) |
| PUT | `/roles/:id` | ADMIN | `{ description?, permission_ids? }` | role |
| DELETE | `/roles/:id` | ADMIN | — | `null` (409 nếu role đang được gán hoặc là role hệ thống) |
| GET | `/permissions` | ADMIN | — | `{ id, code, description }[]` |

### 2.4 Brands — M4 (`/brands`)

| Method | Path | Role | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/brands` | public | `?page&limit&q&status` (public mặc định chỉ `ACTIVE`) | `BrandDTO[]` + meta | — |
| GET | `/brands/:id` | public | — | `BrandDTO` | 404 |
| POST | `/brands` | ADMIN/STAFF | `{ name, slug?, description?, logo_url?, status? }` | `BrandDTO` (201) | 400; 409 `Slug already exists` |
| PUT | `/brands/:id` | ADMIN/STAFF | partial | `BrandDTO` | 400, 404, 409 |
| DELETE | `/brands/:id` | ADMIN | — | `null` | 404; 409 `Brand has products` |

Slug tự sinh từ `name` (kebab, bỏ dấu tiếng Việt) nếu không truyền.

### 2.5 Categories — M4 (`/categories`)
Giống §2.4, thay `BrandDTO`→`CategoryDTO`, không có `logo_url`.

### 2.6 Products — M4 (`/products`)

| Method | Path | Role | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/products` | public | `?page&limit&q&brand_id&category_id&gender&concentration&min_price&max_price&in_stock=true&status&sort=price:asc\|created_at:desc\|name:asc` | `ProductDTO[]` (variants + images rút gọn) + meta | 400 |
| GET | `/products/:id` | public | `:id` là số **hoặc** slug | `ProductDTO` | 404 |
| POST | `/products` | ADMIN/STAFF | `{ name, slug?, brand_id, category_id, gender, origin?, concentration, fragrance_family?, description?, status?, variants?: [{sku, volume_ml, price, sale_price?}] }` | `ProductDTO` (201) | 400 (TC03); 404 brand/category; 409 slug/SKU trùng |
| PUT | `/products/:id` | ADMIN/STAFF | partial (không gồm variants) | `ProductDTO` | 400, 404, 409 |
| DELETE | `/products/:id` | ADMIN | — | `null` (soft delete) | 404 |

**Lưu ý:** product không có giá/stock riêng — `price_range` và `total_stock` được service tính từ variants.

### 2.7 Product Variants — M4 (`/products/:productId/variants`, `/variants/:id`)

| Method | Path | Role | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/products/:productId/variants` | public | — | `VariantDTO[]` | 404 |
| POST | `/products/:productId/variants` | ADMIN/STAFF | `{ sku, volume_ml, price, sale_price?, status? }` | `VariantDTO` (201) | 400; 409 `SKU already exists` / `Volume already exists for this product` |
| PUT | `/variants/:id` | ADMIN/STAFF | `{ sku?, volume_ml?, price?, sale_price?, status? }` | `VariantDTO` | 400, 404, 409 |
| DELETE | `/variants/:id` | ADMIN | — | `null` | 404; 409 `Variant is used in orders` |

`stock_quantity` **không** sửa được qua endpoint này — chỉ qua Inventory (§2.9).

### 2.8 Product Images — M4 (`/products/:productId/images`)

| Method | Path | Role | Request | Response | Errors |
|---|---|---|---|---|---|
| POST | `/products/:productId/images` | ADMIN/STAFF | `multipart/form-data`: `files[]` (≤5 file, ≤2MB/file, jpg/png/webp), `is_primary?` | `ImageDTO[]` (201) | 400 `Invalid file type`/`File too large`; 404; 502 `Upload failed` |
| PATCH | `/products/:productId/images/:imageId/primary` | ADMIN/STAFF | — | `ImageDTO[]` | 404 |
| DELETE | `/products/:productId/images/:imageId` | ADMIN/STAFF | — | `null` (xoá cả trên Cloudinary) | 404 |

### 2.9 Inventory — M5 (`/inventory`)

| Method | Path | Role | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/inventory` | ADMIN/STAFF | `?page&limit&q&brand_id&category_id&low_stock=true&sort=stock_quantity:asc` | `{ variant_id, sku, product_id, product_name, brand_name, volume_ml, stock_quantity, price, is_low_stock }[]` + meta | 400 |
| GET | `/inventory/summary` | ADMIN/STAFF | — | `{ total_variants, total_stock, low_stock_count, out_of_stock_count, stock_value }` | — |
| POST | `/inventory/import` | ADMIN/STAFF | `{ items: [{ variant_id, quantity }], note? }` — `quantity > 0` | `{ transactions: InvTxnDTO[] }` (201) | 400; 404 variant |
| POST | `/inventory/export` | ADMIN/STAFF | `{ items: [{ variant_id, quantity }], note? }` — `quantity > 0` | `{ transactions: InvTxnDTO[] }` (201) | 400; 404; 422 `Insufficient stock` |
| POST | `/inventory/adjustment` | ADMIN | `{ variant_id, new_quantity, note }` (note **bắt buộc**) | `{ transaction: InvTxnDTO }` (201) | 400; 404; 422 nếu `new_quantity < 0` |
| GET | `/inventory/transactions` | ADMIN/STAFF | `?page&limit&variant_id&type&from&to` | `InvTxnDTO[]` + meta | 400 |
| GET | `/inventory/low-stock` | ADMIN/STAFF | `?limit` | như `GET /inventory` filter low | — |

Mọi ghi stock chạy trong `prisma.$transaction`: đọc stock → check → `update` → `create` txn với `stock_before`/`stock_after`. Dùng atomic `update ... where stock >= n` (hoặc `SELECT ... FOR UPDATE`) để chống race.

### 2.10 Customers — M6 (`/customers`, ADMIN/STAFF)

| Method | Path | Role | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/customers` | ADMIN/STAFF | `?page&limit&q&status&sort=total_spending:desc` | `CustomerDTO[]` + meta | 400 |
| GET | `/customers/:id` | ADMIN/STAFF | — | `CustomerDTO & { recent_orders: OrderDTO[] }` | 404 |
| GET | `/customers/:id/orders` | ADMIN/STAFF | `?page&limit&status` | `OrderDTO[]` (list shape) + meta | 404 |
| PATCH | `/customers/:id/status` | ADMIN | `{ status: "ACTIVE"\|"LOCKED" }` (ghi vào `users.status`) | `CustomerDTO` | 404 |

### 2.11 Cart — M7 (`/cart`, CUSTOMER)

| Method | Path | Role | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/cart` | CUSTOMER | — | `CartDTO` (rỗng → `items: []`, tự tạo cart nếu chưa có) | 401, 403 |
| POST | `/cart/items` | CUSTOMER | `{ variant_id, quantity }` | `CartDTO` | 400; 404; 409 `Variant is inactive`; 422 `Quantity exceeds available stock` (TC04) |
| PUT | `/cart/items/:itemId` | CUSTOMER | `{ quantity }` (≥1) | `CartDTO` | 400, 403, 404, 422 (TC04) |
| DELETE | `/cart/items/:itemId` | CUSTOMER | — | `CartDTO` | 403, 404 |
| DELETE | `/cart` | CUSTOMER | — | `CartDTO` (rỗng) | 401 |
| POST | `/cart/preview` | CUSTOMER | `{ promotion_code? }` | `{ subtotal, discount_amount, shipping_fee, total_amount, promotion: PromotionDTO\|null, warnings: [{variant_id, message}] }` | 400; 422 promotion invalid |

`POST /cart/items` cộng dồn nếu variant đã có trong cart; tổng sau cộng vẫn phải ≤ stock.

### 2.12 Orders — M7 (`/orders`)

| Method | Path | Role | Request | Response | Errors |
|---|---|---|---|---|---|
| POST | `/orders` | CUSTOMER | `{ receiver_name, receiver_phone, shipping_address, note?, promotion_code?, payment_method: "COD"\|"BANK_TRANSFER" }` (items lấy từ cart) | `OrderDTO` (201) — TC06 | 400; 409 `Cart is empty`; 422 `Insufficient stock for <sku>` (TC05) / promotion invalid |
| GET | `/orders/my` | CUSTOMER | `?page&limit&status` | `OrderDTO[]` (list shape) + meta | 401 |
| GET | `/orders/:id` | CUSTOMER (của mình) / ADMIN/STAFF | — | `OrderDTO` | 403 nếu không phải đơn của mình; 404 |
| PATCH | `/orders/:id/cancel` | CUSTOMER (`PENDING`) / ADMIN/STAFF (`PENDING`\|`CONFIRMED`) | `{ reason }` | `OrderDTO` | 400; 403; 409 `Cannot cancel order in status SHIPPING` |
| GET | `/orders` | ADMIN/STAFF | `?page&limit&q(order_code/phone)&status&from&to&customer_id&sort` | `OrderDTO[]` (list shape) + meta | 400, 403 |
| PATCH | `/orders/:id/status` | ADMIN/STAFF | `{ status, note? }` | `OrderDTO` | 400; 409 `Invalid status transition PENDING → SHIPPING` (TC08); 404 |
| PATCH | `/orders/:id/return` | ADMIN | `{ reason }` (chỉ từ `COMPLETED`) | `OrderDTO` | 409 |
| PATCH | `/orders/:id/payment` | ADMIN/STAFF | `{ status: "PAID"\|"REFUNDED" }` | `OrderDTO` | 400, 404 |
| GET | `/orders/:id/invoice` | ADMIN/STAFF | — | `OrderDTO & { printed_at }` (dữ liệu để FE in) | 404 |

**Transition map (service enforce, nguồn: CLAUDE.md §7):**
```
PENDING   → CONFIRMED | CANCELLED
CONFIRMED → PACKING   | CANCELLED
PACKING   → SHIPPING
SHIPPING  → COMPLETED
COMPLETED → RETURNED
CANCELLED → ∅ ;  RETURNED → ∅
```

**Checkout (1 `$transaction`):** lock + check stock từng item → tạo `orders` + `order_details` (snapshot `product_name`, `sku`, `volume_ml`, `unit_price`) → trừ stock + ghi `SALE` (`reference="ORDER:<id>"`) → tạo `payments` (UNPAID) → nếu có promotion: `used_count++` + `promotion_usages` → xoá `cart_items`.
**Cancel / Return (1 `$transaction`):** cộng lại stock + ghi `RETURN` → `status` mới → nếu có promotion: `used_count--` + xoá usage.
**COMPLETED:** set `completed_at`, cập nhật `customers.total_orders` + `total_spending`.

### 2.13 Promotions — M8 (`/promotions`)

| Method | Path | Role | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/promotions` | ADMIN/STAFF | `?page&limit&q&status&active_only` | `PromotionDTO[]` + meta | 400 |
| GET | `/promotions/:id` | ADMIN/STAFF | — | `PromotionDTO & { usages_count }` | 404 |
| POST | `/promotions` | ADMIN | full fields | `PromotionDTO` (201) | 400 (`end_date > start_date`, PERCENTAGE value 1–100); 409 `Code already exists` |
| PUT | `/promotions/:id` | ADMIN | partial | `PromotionDTO` | 400, 404, 409 |
| PATCH | `/promotions/:id/status` | ADMIN | `{ status }` | `PromotionDTO` | 404 |
| DELETE | `/promotions/:id` | ADMIN | — | `null` | 409 `Promotion already used` |
| POST | `/promotions/validate` | CUSTOMER | `{ code, subtotal }` | `{ valid:true, promotion: PromotionDTO, discount_amount }` | 404 `Promotion code not found`; 422 + `message` cụ thể: `Promotion is not active` / `Promotion has expired` / `Promotion has not started` / `Usage limit reached` / `Order does not meet minimum value` / `You have already used this promotion` |

### 2.14 Reviews — M10 (`/reviews`)

| Method | Path | Role | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/products/:productId/reviews` | public | `?page&limit&rating` | `ReviewDTO[]` + meta + `{ summary: { average, total, breakdown: {1..5} } }` | 404 |
| POST | `/products/:productId/reviews` | CUSTOMER | `{ rating:1..5, comment? }` | `ReviewDTO` (201) | 400; 403 `You must purchase this product first`; 409 `You already reviewed this product` |
| PUT | `/reviews/:id` | CUSTOMER (của mình) | `{ rating?, comment? }` | `ReviewDTO` | 403, 404 |
| GET | `/reviews` | ADMIN/STAFF | `?page&limit&product_id&rating&is_hidden` | `ReviewDTO[]` + meta | 403 |
| PATCH | `/reviews/:id/visibility` | ADMIN | `{ is_hidden: boolean }` | `ReviewDTO` | 404 |
| DELETE | `/reviews/:id` | ADMIN | — | `null` | 404 |

### 2.15 Dashboard & Reports — M9 (`/reports`, ADMIN/STAFF)

Mọi endpoint nhận `?range=today|7d|30d|this_month|custom` + `from`/`to` (bắt buộc khi `custom`). Doanh thu **chỉ** tính `COMPLETED`.

| Method | Path | Role | Response `data` |
|---|---|---|---|
| GET | `/reports/dashboard` | ADMIN/STAFF | `{ revenue, order_count, customer_count, product_count, pending_orders, low_stock_count, revenue_change_pct }` |
| GET | `/reports/revenue` | ADMIN/STAFF | `?group_by=day\|month` → `{ series: [{ period, revenue, order_count }] }` |
| GET | `/reports/top-products` | ADMIN/STAFF | `?limit=10` → `{ items: [{ product_id, product_name, brand_name, quantity_sold, revenue }] }` |
| GET | `/reports/revenue-by-brand` | ADMIN/STAFF | `{ items: [{ brand_id, brand_name, revenue, order_count, share_pct }] }` |
| GET | `/reports/order-status` | ADMIN/STAFF | `{ items: [{ status, count }] }` |
| GET | `/reports/low-stock` | ADMIN/STAFF | `?limit=20` → `{ items: [{ variant_id, sku, product_name, volume_ml, stock_quantity }] }` |

Lỗi chung: 400 `Invalid date range` khi `range=custom` thiếu `from`/`to` hoặc `from > to`.

---

## 3. Orchestration waves

Mỗi wave = một batch song song. **Trong một wave, Claude và Codex làm độc lập, không chờ nhau.** Giữa hai wave có integration gate do Claude chạy.

```
W1 ──► W2 ──► W3 ──┬──► W4 ──► W5 ──► W6 ──► W7
                   └─ (W4a Inventory ∥ W4b Customer)
```

| Wave | Milestone | Codex (backend) | Claude (frontend) | Dependency | Gate |
|---|---|---|---|---|---|
| **W1** | M1 + M2 | Init Express, `config/env.js` + `database.js`, response helper, `AppError`, validation middleware, global error handler, `GET /health`; **toàn bộ `schema.prisma`** + migration + seed idempotent | Init Vite + React + AntD + Router + axios instance (interceptor attach token, refresh-on-401, unwrap envelope) + TanStack Query provider; 3 layout (Customer/Admin/Auth); trang placeholder + `.env.example` | — | `npm run dev` cả 2; `prisma migrate dev` + `seed` sạch; FE gọi `/health` OK |
| **W2** | M3 | module `auth`, `users`, `roles`: bcrypt, JWT access+refresh, refresh rotation, forgot/reset, `auth.middleware`, `role.middleware`, `permission` check | AuthContext + token storage, Login/Register/Forgot/Reset page, route guard theo role, Admin Users/Roles page, Profile + Change password | W1 (schema) | TC01, TC02, TC09 pass; 3 role vào đúng portal |
| **W3** | M4 | `brands`, `categories`, `products`, `product-variants`, `product-images` + Cloudinary (multer memory → stream upload), slug util, search/filter/pagination | Admin: Brand/Category CRUD table+modal, Product list/create/edit (form + variant sub-table + image uploader), Product detail; Customer: Home, Product list (filter sidebar + pagination), Product detail (chọn variant) | W2 (auth) | TC03 pass; admin CRUD đủ 5 resource; customer browse được |
| **W4a** | M5 | `inventory`: overview, summary, import, export, adjustment, transactions, low-stock — tất cả trong `$transaction`, chống stock âm | Admin: Inventory overview (low-stock badge), modal Import/Export/Adjustment, Transaction history (filter type/variant/date) | W3 (variants) | Stock không âm; mọi thay đổi có txn khớp `stock_before/after` |
| **W4b** | M6 | `customers`: list/search/filter, detail + recent orders, order history, lock/unlock | Admin: Customer list, Customer detail (profile + tổng đơn/tổng chi + order history) | W2 | Lock user → login 403 |
| **W5** | M7 | `carts`, `orders`: checkout `$transaction`, transition map, cancel/return hoàn kho, `payments`, order code generator | Customer: Cart page, Checkout, Order history, Order detail, Cancel; Admin: Order list, Order detail, Confirm, Update status (stepper), Cancel, Return | W4a (stock), W4b (customer) | **MVP flow end-to-end**; TC04–TC08 pass |
| **W6** | M8 + M9 | `promotions` CRUD + validate + apply vào cart/checkout; `reports` 6 endpoint | Admin: Promotion CRUD, Dashboard (KPI cards + charts + range filter), Reports page; Customer: nhập voucher ở cart/checkout | W5 | Số dashboard khớp query DB tay; voucher đúng rule |
| **W7** | M10 + hardening | `reviews` (verified purchase) + admin moderation; hoàn thiện Jest/Supertest TC01–TC09; rate limit login, helmet, CORS env | Customer: review form + list ở Product detail; Admin: Review moderation; Vitest FE cho guard + cart logic; README + Installation Guide | W5 (order COMPLETED) | Full test suite xanh; lint/build sạch |

### Integration gate (Claude chạy sau mỗi wave)
1. `cd backend && npm run lint && npm test && npx prisma validate`
2. `cd frontend && npm run lint && npm run build`
3. Smoke test contract bằng `backend/tests/http/*.http` (hoặc Postman collection) — so khớp từng response với §2.
4. Code review ranh giới kiến trúc: controller không query DB, route không có logic, không duplicate.
5. Chỉ pass gate mới mở wave sau; lệch contract → cập nhật §2 trước rồi mới sửa code hai phía.

---

## 4. Testing strategy

### Backend — Jest + Supertest (`backend/tests/`)
```
tests/
├── setup.js                  # test DB (perfume_shop_test), migrate + truncate giữa các test
├── helpers/auth.js           # loginAs('ADMIN'|'STAFF'|'CUSTOMER') → token
├── unit/                     # service thuần: transition map, promotion calc, stock math, slug
└── integration/              # supertest theo module: auth, product, inventory, cart, order, promotion, report
```
- DB test riêng, không dùng DB dev. Mỗi test file tự seed dữ liệu tối thiểu.
- Target coverage: service layer ≥ 80%; 100% cho `order.service` transition + `inventory.service`.

### Test case bắt buộc (CLAUDE.md §9)

| ID | Layer | Setup | Action | Expected | Owner |
|---|---|---|---|---|---|
| TC01 | integration | seed admin | `POST /auth/login` đúng mật khẩu | 200, có `accessToken` + `user.roles` | Codex |
| TC02 | integration | seed admin | login sai password | 401 `Invalid credentials`, không trả token | Codex |
| TC03 | integration | admin token, brand+category | `POST /products` hợp lệ | 201, `ProductDTO` có brand/category; slug unique | Codex |
| TC04 | integration | variant stock = 5 | `POST /cart/items` quantity = 6 | 422 `Quantity exceeds available stock`; cart không đổi | Codex |
| TC05 | integration | cart có 2 item, variant bị export về 0 | `POST /orders` | 422 `Insufficient stock for <sku>`; **không** tạo order, stock nguyên | Codex |
| TC06 | integration | cart hợp lệ, stock đủ | `POST /orders` | 201, status `PENDING`, `order_details` snapshot đúng giá, cart rỗng | Codex |
| TC07 | integration | sau TC06 | query stock + txn | `stock_after = stock_before - qty`; có txn `SALE` với `reference=ORDER:<id>` | Codex |
| TC08 | unit + integration | order `PENDING` | `PATCH /orders/:id/status {SHIPPING}` | 409 `Invalid status transition`; status không đổi | Codex |
| TC09 | integration | staff token | `GET /roles`, `POST /users` | 403 `Forbidden` cả hai | Codex |

Bổ sung (không bắt buộc nhưng nên có): cancel order hoàn kho + ghi `RETURN`; promotion hết `usage_limit` → 422; adjustment về số âm → 422; review khi chưa mua → 403; dashboard revenue chỉ đếm `COMPLETED`.

### Frontend — Vitest + RTL (`frontend/src/**/*.test.jsx`)
- Route guard: CUSTOMER vào `/admin` → redirect; chưa login vào protected route → `/login`.
- Cart quantity > stock → hiện lỗi, không gọi API.
- Form validation (login, product, promotion date range).
- Mock API bằng MSW theo đúng envelope §2 — MSW handler là bản *kiểm chứng contract* ở phía FE.

### Manual / MVP acceptance
Chạy đúng flow CLAUDE.md §9 trên UI thật sau W5 và lại sau W7. Ghi kết quả vào `docs/test-report.md`.

---

## 5. Env variables

`backend/.env.example`
```
PORT=4000
NODE_ENV=development
DATABASE_URL="mysql://perfume:perfume@localhost:3307/perfume_shop"
DATABASE_URL_TEST="mysql://perfume:perfume@localhost:3307/perfume_shop_test"
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
CORS_ORIGIN=http://localhost:5173
LOW_STOCK_THRESHOLD=5
DEFAULT_SHIPPING_FEE=30000
STORAGE_DRIVER=local
UPLOAD_DIR=uploads
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
SEED_PASSWORD=
```
`frontend/.env.example`
```
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

---

### 5.1 `docker-compose.yml` (root) — OD-4

```yaml
services:
  mysql:
    image: mysql:8.4
    container_name: perfume-mysql
    restart: unless-stopped
    ports: ["3307:3306"]                 # 3307 để không đụng MySQL Homebrew trên máy
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: perfume_shop
      MYSQL_USER: perfume
      MYSQL_PASSWORD: perfume
    volumes:
      - mysql_data:/var/lib/mysql
      - ./backend/prisma/docker-init.sql:/docker-entrypoint-initdb.d/01-init.sql:ro
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-uroot", "-proot"]
      interval: 5s
      retries: 10
volumes:
  mysql_data:
```

`backend/prisma/docker-init.sql` tạo DB test và cấp quyền:
```sql
CREATE DATABASE IF NOT EXISTS perfume_shop_test   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS perfume_shop_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON perfume_shop.*        TO 'perfume'@'%';
GRANT ALL PRIVILEGES ON perfume_shop_test.*   TO 'perfume'@'%';
GRANT ALL PRIVILEGES ON perfume_shop_shadow.* TO 'perfume'@'%';
FLUSH PRIVILEGES;
```

Lệnh chuẩn: `docker compose up -d` → `cd backend && npx prisma migrate dev` → `npm run seed`.
Reset sạch: `docker compose down -v && docker compose up -d`.

---

## 6. Decisions — ĐÃ DUYỆT (2026-10-06)

Tất cả Open Decisions đã được chốt. Không còn blocker cho Wave 1.

| # | Vấn đề | **Quyết định** | Ảnh hưởng thi công |
|---|---|---|---|
| **OD-1** | Vị trí repo | **Giữ nguyên repo hiện tại** — tạo `backend/` + `frontend/` ngay tại root. `MISSION.md`, `docs/`, `package-lock.json` (`vibecoding-erp`), `orca/`, `lessons/`, `learning-records/` thuộc dự án song song → **không đọc, không sửa, không xoá** | `.gitignore` root phải bỏ qua `node_modules`, `.env`, `dist`, `.DS_Store`; không chạy `npm install` ở root (chỉ trong `backend/` và `frontend/`) |
| **OD-2** | `users` ↔ `customers` | **Một nguồn auth duy nhất**: `users` giữ email/password/status cho cả 3 role; `customers` là profile nghiệp vụ 1-1 cho role CUSTOMER (địa chỉ, `total_orders`, `total_spending`). Schema §1 đã đúng | Register tạo `User` + `Customer` + `Cart` + gán role CUSTOMER trong **1 `$transaction`**. Lock khách hàng = ghi `users.status = LOCKED` |
| **OD-3** | Lưu refresh token ở FE | **`localStorage`** | `src/api/client.js`: interceptor đọc access token từ memory + localStorage, auto-refresh khi 401, refresh fail → clear + redirect `/login`. Có refresh-token rotation ở BE để giảm rủi ro |
| **OD-4** | MySQL dev | **Docker Compose** | Thêm `docker-compose.yml` ở root (xem §5.1). MySQL container map ra **port 3307** để không đụng MySQL 9.5 Homebrew đang có trên máy. Container tạo sẵn 2 DB: `perfume_shop` + `perfume_shop_test` |
| **OD-5** | Cloudinary | **W3 dùng local disk storage qua adapter; cắm Cloudinary sau khi có key** | Bắt buộc có `src/utils/storage.service.js` với interface cố định `upload(buffer, filename, folder) → {url, public_id}` / `destroy(public_id)`. Chọn impl theo env `STORAGE_DRIVER=local\|cloudinary`. Driver `local` ghi vào `backend/uploads/` (đã gitignore) và serve qua `express.static('/uploads')`. **Đổi driver không được sửa code module `product-images`** |
| **OD-6** | Email forgot-password | **Chưa gửi email thật.** `NODE_ENV=development` → trả `reset_token` trong response + log; production → chỉ 200 rỗng | Không thêm dependency SMTP. FE Forgot-password page hiển thị thông báo chung, dev mode cho phép paste token vào Reset page |
| **OD-7** | Shipping fee | **Phẳng, lấy từ env `DEFAULT_SHIPPING_FEE=30000`** | `/cart/preview` và `/orders` đều trả `shipping_fee` từ env, không hard-code ở FE |
| **OD-8** | Promotion per-customer | **1 lần/khách** (`per_customer_limit = 1` default) | `promotion.service` check `promotion_usages` theo `(promotion_id, customer_id)` trước khi cho dùng |
| **OD-9** | Payment online | **Không làm.** Chỉ `COD` / `BANK_TRANSFER`, status cập nhật tay bởi ADMIN/STAFF qua `PATCH /orders/:id/payment` | Không tích hợp cổng thanh toán nào |
| **OD-10** | Ngôn ngữ UI | **Tiếng Việt toàn bộ UI**; code/identifier/commit message tiếng Anh | Không setup i18n. AntD dùng `locale={viVN}`, format tiền VND, ngày `dd/MM/yyyy` |
| **OD-11** | Branch strategy | **`main` + `develop` + feature branch**, PR vào `develop`; `develop` → `main` khi qua gate | Codex: `feature/be-<scope>`. Claude: `feature/fe-<scope>`. Không commit trực tiếp `main` |
| **OD-12** | Deploy | **Chỉ sau W7** | Backend → Render/Railway, Frontend → Vercel, MySQL cloud |

Nếu phát sinh quyết định mới trong lúc thi công: agent **dừng và hỏi**, không tự đoán (CLAUDE.md §10.5). Quyết định mới ghi tiếp vào bảng này.
