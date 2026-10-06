# CLAUDE.md — Perfume Shop Management System

Hệ thống quản lý shop nước hoa: website khách hàng + Admin Portal. Trọng tâm là **nghiệp vụ quản lý** (variant/SKU, nhập–xuất–tồn, vòng đời đơn hàng, phân quyền, báo cáo từ dữ liệu thật), không chỉ là website bán hàng.

---

## 1. Stack (đã chốt — không thêm framework khác)

| Layer | Công nghệ |
|---|---|
| Frontend | React (Vite), Ant Design, React Router, Axios, TanStack Query, Context API (auth) |
| Backend | Node.js, Express, REST, JWT (access + refresh), Prisma |
| Database | MySQL |
| Image | Cloudinary |
| Test | Backend: Jest + Supertest · Frontend: Vitest + React Testing Library |

---

## 2. Repository layout

```text
perfume-shop/
├── backend/
│   ├── src/
│   │   ├── config/          # env.js, database.js (Prisma client)
│   │   ├── modules/<name>/  # 1 thư mục / module
│   │   ├── middleware/      # auth, role, validation, error
│   │   ├── utils/           # response helper, AppError, pagination
│   │   ├── routes/          # mount module routes vào /api/v1
│   │   └── app.js
│   ├── prisma/              # schema.prisma, migrations/, seed.js
│   ├── tests/
│   └── .env.example
└── frontend/
    └── src/
        ├── api/             # axios instance + API functions (duy nhất nơi gọi HTTP)
        ├── features/<name>/ # pages, components, hooks theo domain
        ├── layouts/         # CustomerLayout, AdminLayout, AuthLayout
        ├── routes/          # router + route guard theo role
        ├── components/      # component dùng chung
        ├── hooks/ utils/
        └── App.jsx
```

Modules: `auth, users, roles, products, product-variants, brands, categories, inventory, customers, carts, orders, promotions, reviews, reports`.

Mỗi backend module:
```text
products/
├── product.route.js       # endpoint + middleware, không logic
├── product.validation.js  # schema validate input
├── product.controller.js  # parse req → gọi service → response
├── product.service.js     # business logic
├── product.repository.js  # query Prisma
└── product.constant.js
```

---

## 3. Backend rules

Luồng: `Route → Middleware (auth, role, validation) → Controller → Service → Repository → DB`

- Controller không query DB; route không chứa logic.
- Business logic chỉ ở service. Query chỉ ở repository.
- Validate input trước khi vào service.
- Mọi lỗi throw `AppError` → global error handler.
- Mọi thao tác ghi đụng tới stock/order dùng `prisma.$transaction`.
- Tạo API mới theo thứ tự: route → validation → controller → service → repository → authorization.
- Danh sách luôn pagination (`page`, `limit`), tránh N+1 (dùng `include`/`select`).
- Soft delete (`status`/`deleted_at`) cho users, products, brands, categories.
- Tiền dùng `Decimal`, không dùng float.

### API convention
Base URL: `/api/v1`. REST: `GET/POST /resources`, `GET/PUT/DELETE /resources/:id`, hành động riêng dùng `PATCH /resources/:id/<action>` (vd `PATCH /orders/:id/status`).

```json
{ "success": true,  "message": "Success", "data": {}, "meta": { "page": 1, "limit": 10, "total": 0 } }
{ "success": false, "message": "Validation failed", "errors": [] }
```

### Security
- bcrypt hash password; không bao giờ trả password/hash qua API.
- Verify JWT ở backend; check role/permission ở backend (frontend guard chỉ là UX).
- Không hard-code secret; thêm env mới thì cập nhật `.env.example`. Không commit `.env`.
- CORS chỉ cho phép origin frontend cấu hình qua env.

---

## 4. Frontend rules

- Chỉ gọi HTTP qua `src/api/`; component dùng TanStack Query hooks.
- Tách 3 layout: Customer / Admin / Auth.
- Mỗi màn hình có đủ: loading, empty, error state, success notification.
- Form phải validation; action nguy hiểm (xóa, hủy đơn, khóa user) phải confirm.
- Component lớn thì tách nhỏ theo feature.

---

## 5. Roles & quyền

| Role | Quyền |
|---|---|
| ADMIN | Toàn quyền: dashboard, sản phẩm, brand, category, tồn kho, đơn, khách hàng, khuyến mãi, review, user, role/permission, báo cáo |
| STAFF | Sản phẩm (theo permission), tồn kho, đơn hàng, xem khách hàng. **Không** quản lý user/role/permission |
| CUSTOMER | Đăng ký/đăng nhập, xem/tìm/lọc sản phẩm, giỏ hàng, đặt/hủy đơn, lịch sử đơn, hồ sơ, review |

---

## 6. Database (Prisma, MySQL)

Bảng:
```text
users, roles, permissions, role_permissions, user_roles
customers
brands, categories, products, product_variants, product_images
inventory_transactions
carts, cart_items
orders, order_details, payments
promotions, promotion_usages
reviews
```

Quan hệ:
```text
Brand ──< Product >── Category
Product ──< ProductVariant ──< InventoryTransaction
Product ──< ProductImage
Product ──< Review >── Customer
Customer ── Cart ──< CartItem >── ProductVariant
Customer ──< Order ──< OrderDetail >── ProductVariant
Order ──< Payment ; Promotion ──< PromotionUsage >── Order
```

Fields chính:
- **brands:** id, name, slug (unique), description, logo_url, status, timestamps
- **products:** name, slug, brand_id, category_id, gender (MALE/FEMALE/UNISEX), origin, concentration (EDT/EDP/PARFUM/EDC), fragrance_family, description, status — **không** có dung tích/giá/stock
- **product_variants:** product_id, sku (unique), volume_ml, price, sale_price, stock_quantity, status
- **inventory_transactions:** variant_id, type, quantity (+/-), stock_before, stock_after, reference (order_id…), note, created_by, created_at
- **promotions:** code (unique), name, discount_type (PERCENTAGE/FIXED), discount_value, minimum_order_value, max_discount, start_date, end_date, usage_limit, used_count, status

Thay đổi DB: sửa `schema.prisma` → tạo migration → cập nhật `seed.js` nếu cần.

---

## 7. Business rules (nguồn sự thật)

### Product / Variant
- 1 product nhiều variant (vd Dior Sauvage EDP: 30/60/100/200ml). Mỗi variant có SKU unique.

### Inventory
- Stock hiện tại = `product_variants.stock_quantity` (chỉ lưu ở 1 chỗ).
- **Mọi** thay đổi stock phải ghi `inventory_transactions` trong cùng DB transaction.
- Types: `IMPORT` (+), `EXPORT` (−), `SALE` (−), `RETURN` (+), `ADJUSTMENT` (±).
- Stock không bao giờ < 0 → reject.
- Low-stock: `stock_quantity <= LOW_STOCK_THRESHOLD` (env, mặc định 5).

### Cart
- Quantity không vượt stock; kiểm tra lại stock khi checkout.

### Order
Trạng thái và chuyển hợp lệ:
```text
PENDING → CONFIRMED → PACKING → SHIPPING → COMPLETED
PENDING | CONFIRMED  → CANCELLED
COMPLETED            → RETURNED
```
- Không cho phép chuyển trạng thái ngoài bảng trên.
- Customer chỉ hủy được khi `PENDING`. Admin/Staff hủy được khi `PENDING`/`CONFIRMED`.
- Checkout (1 DB transaction): kiểm tra stock → tạo order + order_details → trừ stock + ghi `SALE` → ghi promotion_usage → xóa cart.
- Hủy đơn / RETURNED: cộng lại stock + ghi `RETURN`.
- Giá snapshot vào `order_details` (unit_price, product_name, sku, volume_ml); không dùng giá hiện tại để tính đơn cũ.

### Promotion
Validate: status active, trong [start_date, end_date], `used_count < usage_limit`, subtotal ≥ minimum_order_value, customer chưa dùng (nếu giới hạn 1 lần/khách). PERCENTAGE bị chặn bởi `max_discount`.

### Review
- Rating 1–5 + comment. Chỉ customer có đơn `COMPLETED` chứa sản phẩm mới được review.
- Admin có thể ẩn/xóa review.

### Dashboard
- KPI: doanh thu hôm nay, số đơn, số khách, số sản phẩm.
- Charts: doanh thu & đơn theo ngày/tháng, top sản phẩm bán chạy, doanh thu theo brand, sản phẩm sắp hết hàng.
- Filter: today, 7d, 30d, this month, custom range.
- Doanh thu chỉ tính đơn `COMPLETED`. Lấy dữ liệu thật từ DB, không hard-code.

---

## 8. Milestones (thứ tự thực hiện)

Mỗi milestone là một nhóm ticket độc lập; làm tuần tự vì milestone sau phụ thuộc milestone trước.

| # | Milestone | Phạm vi | Definition of Done |
|---|---|---|---|
| M1 | Setup | Init BE (Express, env, Prisma, MySQL, error handler, response helper, validation middleware, `GET /api/v1/health`); init FE (Vite, AntD, router, axios instance, 3 layouts) | FE & BE chạy, DB connect, health API OK |
| M2 | Schema | Toàn bộ `schema.prisma` + migration + seed (roles, admin, staff, permissions, vài brand/category/product mẫu) | `prisma migrate` + `seed` chạy sạch |
| M3 | Auth & User | Register, login, logout, refresh token, forgot/reset/change password, profile, user CRUD, role/permission, lock/unlock | Protected route + RBAC đúng 3 role |
| M4 | Catalog | Brand, Category, Product, Variant CRUD, upload ảnh Cloudinary, search/filter/pagination | Admin quản lý đủ product/brand/category/variant/image |
| M5 | Inventory | Overview, import, export, adjustment, lịch sử transaction, low-stock | Không stock âm, mọi thay đổi có transaction |
| M6 | Customer | List/search/filter, detail, lịch sử đơn, tổng đơn/tổng chi, lock/unlock | Admin xem & quản lý khách |
| M7 | Cart & Order | Cart, checkout, order history/detail, hủy đơn; admin list/detail/confirm/update status/cancel/return | Luồng MVP (mục 9) chạy end-to-end |
| M8 | Promotion | CRUD voucher, apply ở cart/checkout | Validate đủ rule mục 7 |
| M9 | Dashboard | KPI + charts + filter | Số liệu khớp DB |
| M10 | Review | Customer review, admin ẩn/xóa | Chỉ review khi đã mua |

Ưu tiên: M1–M7 + M9 là core. M8, M10 làm sau. Không làm AI/chatbot/payment online/email trước khi xong core.

---

## 9. MVP acceptance flow

```text
Admin login → tạo Brand → tạo Category → tạo Product → tạo Variants → Import stock
→ Customer register/login → browse → add to cart → checkout → order created (stock giảm, có SALE)
→ Admin confirm → PACKING → SHIPPING → COMPLETED → Dashboard cập nhật
```

Test case bắt buộc:

| ID | Scenario | Expected |
|---|---|---|
| TC01 | Login đúng | Success |
| TC02 | Sai password | Error 401 |
| TC03 | Tạo product hợp lệ | Created |
| TC04 | Cart quantity > stock | Rejected |
| TC05 | Checkout khi hết hàng | Rejected |
| TC06 | Checkout hợp lệ | Order created |
| TC07 | Sau checkout | Stock giảm + có transaction SALE |
| TC08 | Chuyển status sai thứ tự | Rejected |
| TC09 | STAFF gọi API quản lý role | 403 |

---

## 10. Agent workflow

1. Đọc file này trước khi sửa code; kiểm tra cấu trúc hiện có trước khi tạo file mới.
2. Thay đổi tối thiểu đúng phạm vi ticket; không phá API hiện có; không duplicate logic.
3. Feature mới phải có: validation, authorization, error handling, UI states (loading/empty/error/success).
4. Sửa inventory/order → dùng DB transaction, không để dữ liệu lệch.
5. Business rule chưa rõ → theo mục 7; vẫn chưa rõ thì dừng và hỏi, không tự đoán.
6. Trước khi báo xong: chạy test + lint + build (nếu đã cấu hình) và báo kết quả thật.
7. Git: branch `feature/<name>`, `fix/<name>`, `refactor/<scope>`; commit dạng `feat: ...`, `fix: ...`. Không commit trực tiếp vào `main`, không commit secret/`.env`.
