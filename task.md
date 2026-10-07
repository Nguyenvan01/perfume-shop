# task.md — Perfume Shop Management System

Checklist thi công theo wave. Owner: **C** = Claude (frontend/review/integration), **X** = Codex (backend).
Contract và schema: xem `implementation_plan.md`. Chưa start wave nào — chờ approve Open Decisions.

Trạng thái: `[ ]` todo · `[~]` đang làm · `[x]` xong · `[!]` blocked

**Decisions đã chốt (plan §6):** repo giữ nguyên tại root · MySQL qua Docker Compose (port **3307**) · storage adapter local trước, Cloudinary sau · refresh token ở `localStorage` · không gửi email thật · shipping fee phẳng từ env · voucher 1 lần/khách · không payment online · UI tiếng Việt · `main`+`develop` · deploy sau W7.

---

## W0 — Planning & Decisions ✅

- [x] **C** Khảo sát repo hiện tại
- [x] **C** Viết `implementation_plan.md` (schema + API contract + wave + testing)
- [x] **C** Viết `task.md`
- [x] **User** Duyệt OD-1 … OD-12
- [x] **C** Ghi quyết định vào plan §6 + §5.1 (docker-compose) + env
- [x] **C** `.gitignore` root: `node_modules/`, `.env`, `dist/`, `build/`, `.DS_Store`, `backend/uploads/` — **không** touch `orca/`, `lessons/`, `learning-records/`, `docs/`, `MISSION.md`
- [x] **C** Tạo branch `develop` từ `main`

---

## W1 — M1 Setup + M2 Schema ✅
*Dependency: W0 ✅ · Hoàn thành 2026-10-06 · gate đã pass*

### Infra — Codex (ngoại lệ ranh giới: 1 file ở root)
- [x] **X** `docker-compose.yml` (root) — MySQL 8.4, port `3307:3306`, user/pass `perfume`, volume `mysql_data`, healthcheck (spec plan §5.1)
- [x] **X** `backend/prisma/docker-init.sql` — tạo `perfume_shop_test` + grant
- [x] **X** Verify: `docker compose up -d` → connect được cả 2 DB; `docker compose down -v` reset sạch

### Backend — Codex
- [x] **X** `backend/package.json`: express, prisma, @prisma/client, bcrypt, jsonwebtoken, zod (hoặc joi), cors, helmet, morgan, dotenv, multer; dev: jest, supertest, eslint, nodemon
- [x] **X** `src/config/env.js` — load + validate env, fail-fast nếu thiếu secret
- [x] **X** `src/config/database.js` — Prisma client singleton
- [x] **X** `src/utils/response.js` — `ok(res, data, message, meta)`, `created(...)`
- [x] **X** `src/utils/AppError.js` — `AppError(statusCode, message, errors?)`
- [x] **X** `src/utils/pagination.js` — parse `page/limit/sort`, clamp `limit ≤ 100`
- [x] **X** `src/utils/slug.js` — slugify có bỏ dấu tiếng Việt
- [x] **X** `src/middleware/validation.middleware.js` — validate `body/query/params`, trả 400 + `errors[]`
- [x] **X** `src/middleware/error.middleware.js` — global handler (AppError → status, Prisma P2002 → 409, còn lại → 500 + log)
- [x] **X** `src/routes/index.js` — mount `/api/v1`
- [x] **X** `src/app.js` + `server.js` — helmet, cors theo `CORS_ORIGIN`, json, morgan, 404 handler
- [x] **X** `GET /api/v1/health` — check DB ping
- [x] **X** `prisma/schema.prisma` — **toàn bộ** model theo plan §1
- [x] **X** Migration đầu tiên `init`
- [x] **X** `prisma/seed.js` idempotent (roles, permissions, role_permissions, 3 user, brands, categories, products+variants+IMPORT txn, 2 promotions)
- [x] **X** `.env.example`, `.gitignore`, `eslint`, script `dev/start/lint/test/seed`
- [x] **X** `tests/setup.js` dùng `DATABASE_URL_TEST` (`perfume_shop_test`), migrate + truncate giữa test; + 1 smoke test `/health`

### Frontend — Claude
- [x] **C** `frontend/` init Vite + React, AntD, react-router-dom, axios, @tanstack/react-query
- [x] **C** `src/api/client.js` — axios instance, baseURL từ env, interceptor: attach access token, unwrap `data`, auto-refresh khi 401, redirect `/login` khi refresh fail
- [x] **C** `src/api/*.js` — stub function cho mọi endpoint ở plan §2 (ký sẵn signature, chưa cần dùng)
- [x] **C** `src/layouts/` — `AuthLayout`, `CustomerLayout` (header/nav/cart badge/footer), `AdminLayout` (sider menu + breadcrumb + user dropdown)
- [x] **C** `src/routes/index.jsx` + `ProtectedRoute` (role-based, chỉ UX)
- [x] **C** `src/components/` — `PageHeader`, `DataTable` (pagination wrapper), `EmptyState`, `ErrorState`, `LoadingState`, `ConfirmButton`
- [x] **C** `src/utils/format.js` — `formatCurrency` (VND), `formatDate` (`dd/MM/yyyy`), `formatStatus` (nhãn tiếng Việt cho mọi enum)
- [x] **C** QueryClient provider + AntD theme + `locale={viVN}` + AntD `App` (notification/message) — UI tiếng Việt (OD-10)
- [x] **C** Trang placeholder cho mọi route; gọi `/health` ở trang chủ để verify kết nối
- [x] **C** `.env.example`, eslint, prettier, script `dev/build/lint/test`

### Gate W1 — Claude
- [x] **C** `docker compose up -d` → BE `npm run dev` + `/health` 200 (`db:"up"`); `prisma migrate dev` + `seed` sạch (chạy 2 lần không nhân bản)
- [x] **C** FE `npm run build` sạch; FE gọi được `/health` qua CORS
- [x] **C** Review schema vs plan §1 (field, enum, index, unique, Decimal)

---

## W2 — M3 Auth, User, Role, Permission ✅
*Dependency: W1 ✅ · Hoàn thành 2026-10-07 · gate đã pass (77 BE test + 24 FE test)*

### Backend — Codex
- [x] **X** `middleware/auth.middleware.js` — verify access token → `req.user = {id, email, roles[], permissions[]}`
- [x] **X** `middleware/role.middleware.js` — `requireRole(...roles)`, `requirePermission(code)`
- [x] **X** module `auth`: register, login, refresh (rotation + revoke cũ), logout, me, update me, change-password, forgot-password, reset-password
- [x] **X** `forgot-password`: `NODE_ENV=development` trả `reset_token` trong response + log; production chỉ 200 rỗng (OD-6)
- [x] **X** bcrypt cost 10; password rule ≥8 có chữ+số; login fail không tiết lộ email tồn tại
- [x] **X** Register tự tạo `Customer` + gán role CUSTOMER + tạo `Cart` (trong 1 `$transaction`)
- [x] **X** Account `LOCKED` → login 403
- [x] **X** module `users`: list/detail/create/update/status/reset-password/soft-delete — ADMIN only; chặn tự khoá/xoá chính mình (409)
- [x] **X** module `roles` + `permissions` — ADMIN only; chặn xoá role hệ thống
- [x] **X** Rate limit `/auth/login` (vd 10 req/5min/IP)
- [x] **X** Tests: **TC01**, **TC02**, **TC09** + refresh rotation, change-password, locked user, user CRUD authz

### Frontend — Claude
- [x] **C** `AuthContext` + `useAuth` — login/logout/refresh, persist token, hydrate `/auth/me`
- [x] **C** Page: Login, Register, Forgot password, Reset password (AuthLayout, validation đầy đủ); dev mode cho phép paste `reset_token` vào Reset page
- [x] **C** Route guard thật: redirect theo role sau login (ADMIN/STAFF → `/admin`, CUSTOMER → `/`)
- [x] **C** Admin: User list (filter role/status/search), Create/Edit modal, Lock/Unlock (confirm), Reset password
- [x] **C** Admin: Role list + gán permission (transfer/checkbox group)
- [x] **C** Profile page + Change password (customer & admin dùng chung component)
- [x] **C** Ẩn menu theo role; 403 page
- [x] **C** Vitest: guard redirect, login form validation

### Gate W2 — Claude
- [x] **C** TC01/TC02/TC09 pass trên BE test; verify lại bằng UI
- [x] **C** 3 role login → vào đúng portal; STAFF không thấy menu Users/Roles **và** API trả 403
- [x] **C** Không response nào chứa `password_hash`

---

## W3 — M4 Catalog (Brand, Category, Product, Variant, Image)
*Dependency: W2 ✅ — sẵn sàng start*

### Backend — Codex
- [ ] **X** module `brands` — CRUD, slug auto, soft delete, chặn xoá khi còn product (409)
- [ ] **X** module `categories` — như trên
- [ ] **X** module `products` — CRUD, `GET /products/:id` nhận id **hoặc** slug, filter `q/brand_id/category_id/gender/concentration/min_price/max_price/in_stock/status`, sort, pagination, tính `price_range` + `total_stock`, tránh N+1 (`include` variants/images/brand/category)
- [ ] **X** Public list chỉ trả `status=ACTIVE` + `deleted_at IS NULL`; admin thấy tất cả
- [ ] **X** module `product-variants` — CRUD, SKU unique (409), `@@unique(product_id, volume_ml)`, chặn xoá khi đã nằm trong order; **không** cho sửa `stock_quantity`
- [ ] **X** module `product-images` — multer memory, validate type/size, upload storage adapter, set primary, delete (xoá cả remote)
- [ ] **X** `utils/storage.service.js` — interface cố định `upload(buffer, filename, folder) → {url, public_id}` / `destroy(public_id)`; driver chọn theo env `STORAGE_DRIVER=local|cloudinary` (OD-5)
- [ ] **X** Driver `local`: ghi `backend/uploads/`, serve qua `express.static('/uploads')`; driver `cloudinary`: stream upload. **Module `product-images` không được biết driver nào đang dùng**
- [ ] **X** Tests: **TC03** + slug/SKU conflict, filter/pagination, authz (CUSTOMER POST product → 403), upload invalid file

### Frontend — Claude
- [ ] **C** Admin Brand: table + create/edit modal + upload logo + delete confirm
- [ ] **C** Admin Category: table + create/edit modal + delete confirm
- [ ] **C** Admin Product list: search, filter brand/category/gender/status, pagination, cột `price_range`/`total_stock`
- [ ] **C** Admin Product create/edit: form (brand/category select, gender, concentration, fragrance family, description) + variant sub-table (inline add/edit, SKU, volume, price, sale price) + image uploader (multi, set primary, remove)
- [ ] **C** Admin Product detail (read-only + variant/image/stock)
- [ ] **C** Customer Home: banner, brand strip, sản phẩm mới, sản phẩm nổi bật
- [ ] **C** Customer Product list: filter sidebar (brand, category, gender, concentration, price range, in-stock), sort, pagination, loading skeleton + empty state
- [ ] **C** Customer Product detail: gallery, chọn variant (giá đổi theo variant), badge hết hàng, nút Add to cart (disabled nếu chưa login — chuẩn bị cho W5)
- [ ] **C** Customer Search result page

### Gate W3 — Claude
- [ ] **C** TC03 pass; admin CRUD đủ 5 resource; customer browse + filter đúng
- [ ] **C** Verify không N+1 (log query khi list 10 product)
- [ ] **C** Review: response khớp `ProductDTO` trong plan §2

---

## W4a — M5 Inventory  ∥  W4b — M6 Customer
*Dependency: W4a cần W3 (variants); W4b cần W2*

### W4a Backend — Codex
- [ ] **X** `inventory.repository` — list variant kèm product/brand, filter low-stock, summary aggregate
- [ ] **X** `GET /inventory`, `GET /inventory/summary`, `GET /inventory/low-stock`
- [ ] **X** `POST /inventory/import` — multi-item, 1 `$transaction`, ghi txn `IMPORT` với `stock_before/after`
- [ ] **X** `POST /inventory/export` — chặn stock âm (422), ghi `EXPORT`
- [ ] **X** `POST /inventory/adjustment` — ADMIN only, `note` bắt buộc, delta = `new_quantity - current`, ghi `ADJUSTMENT`
- [ ] **X** `GET /inventory/transactions` — filter `variant_id/type/from/to`, pagination
- [ ] **X** Atomic update chống race (`update where stock >= n` / `FOR UPDATE`)
- [ ] **X** Tests: import/export/adjustment đúng stock + txn; export quá stock → 422; adjustment âm → 422; stock chưa bao giờ < 0

### W4a Frontend — Claude
- [ ] **C** Admin Inventory overview: table (SKU, product, volume, stock, low-stock tag), filter brand/category/low-stock, summary cards
- [ ] **C** Modal Import stock (multi-row: chọn variant + quantity + note)
- [ ] **C** Modal Export stock (hiện stock hiện tại, validate ≤ stock)
- [ ] **C** Modal Adjustment (ADMIN only, hiện stock cũ → mới, note bắt buộc)
- [ ] **C** Inventory transactions page: filter type/variant/date range, pagination, hiển thị `stock_before → stock_after`
- [ ] **C** Low-stock widget (dùng lại ở Dashboard W6)

### W4b Backend — Codex
- [ ] **X** module `customers` — list (search tên/email/phone, filter status, sort `total_spending`), detail + `recent_orders`, order history, `PATCH /:id/status` (ghi `users.status`)
- [ ] **X** `total_orders`/`total_spending` — hàm tính lại từ order `COMPLETED` (dùng ở W5 khi order COMPLETED)
- [ ] **X** Tests: authz STAFF xem được / lock là ADMIN only; search đúng

### W4b Frontend — Claude
- [ ] **C** Admin Customer list: search, filter status, cột tổng đơn/tổng chi, pagination
- [ ] **C** Admin Customer detail: thông tin, KPI tổng đơn/chi, tab order history, Lock/Unlock (confirm)

### Gate W4 — Claude
- [ ] **C** Chạy script kiểm tra: `SUM(inventory_transactions.quantity)` per variant == `stock_quantity`
- [ ] **C** Không có đường nào sửa stock mà không ghi txn (grep `stock_quantity` trong backend)
- [ ] **C** Lock customer → login 403

---

## W5 — M7 Cart & Order (MVP core)
*Dependency: W4a + W4b*

### Backend — Codex
- [ ] **X** module `carts`: `GET /cart` (auto-create), add item (cộng dồn, check stock → 422 **TC04**), update quantity, remove item, clear, `POST /cart/preview` (subtotal/discount/shipping/total + warnings nếu stock đổi)
- [ ] **X** `order.constant.js` — transition map theo plan §2.12
- [ ] **X** `order.service.createOrder` — 1 `$transaction`: validate cart không rỗng → re-check stock (**TC05**) → sinh `order_code` → tạo order + order_details **snapshot** → trừ stock + ghi `SALE` `reference=ORDER:<id>` (**TC07**) → tạo `payments` UNPAID → promotion `used_count++` + `promotion_usages` (nếu có) → clear cart
- [ ] **X** `GET /orders/my`, `GET /orders/:id` (ownership check → 403)
- [ ] **X** `PATCH /orders/:id/cancel` — customer chỉ `PENDING`, admin/staff `PENDING|CONFIRMED`; hoàn kho + ghi `RETURN`; rollback promotion
- [ ] **X** `GET /orders` (admin filter/search/date range), `PATCH /orders/:id/status` enforce transition (**TC08**), `PATCH /orders/:id/return` (chỉ từ COMPLETED, hoàn kho), `PATCH /orders/:id/payment`, `GET /orders/:id/invoice`
- [ ] **X** Khi `COMPLETED`: set `completed_at`, cập nhật `customers.total_orders` + `total_spending`
- [ ] **X** Tests: **TC04, TC05, TC06, TC07, TC08** + cancel hoàn kho đúng + ownership 403 + concurrent checkout 2 request cùng variant stock 1 → chỉ 1 thành công

### Frontend — Claude
- [ ] **C** Cart page: list item (ảnh, tên, volume, SKU, đơn giá, quantity stepper giới hạn stock), remove (confirm), clear, summary (subtotal/discount/shipping/total), cảnh báo item hết hàng
- [ ] **C** Cart badge ở header (TanStack Query, invalidate sau mutate)
- [ ] **C** Checkout page: form người nhận (prefill từ profile), note, chọn payment method, ô voucher (gọi `/cart/preview`), order summary, submit → redirect order detail + success notification
- [ ] **C** Customer Order history: filter status, pagination, status tag màu
- [ ] **C** Customer Order detail: timeline status, chi tiết item (giá snapshot), tổng tiền, nút Cancel (chỉ `PENDING`, confirm + lý do)
- [ ] **C** Admin Order list: search order_code/phone, filter status + date range, pagination
- [ ] **C** Admin Order detail: thông tin khách/giao hàng, item, tổng tiền, stepper status, nút Confirm / Next status / Cancel / Return / Mark paid — **chỉ hiện action hợp lệ theo transition map**
- [ ] **C** In hoá đơn (print view từ `/invoice`)
- [ ] **C** Vitest: cart quantity > stock chặn ở UI; action buttons theo transition map

### Gate W5 — MVP acceptance (Claude)
- [ ] **C** TC04–TC08 pass trên BE test
- [ ] **C** Chạy tay full flow CLAUDE.md §9 trên UI: admin login → brand → category → product → variants → import → customer register → browse → cart → checkout → admin confirm → PACKING → SHIPPING → COMPLETED
- [ ] **C** Verify DB sau flow: stock giảm đúng, có txn `SALE`, `order_details` giữ giá snapshot (đổi giá variant rồi xem lại đơn cũ → giá không đổi), `customers.total_spending` đúng
- [ ] **C** Ghi `docs/test-report.md`

---

## W6 — M8 Promotion + M9 Dashboard/Report
*Dependency: W5*

### Backend — Codex
- [ ] **X** module `promotions` — CRUD (validate `end_date > start_date`, PERCENTAGE 1–100, FIXED > 0), status toggle, chặn xoá khi đã dùng
- [ ] **X** `POST /promotions/validate` — trả `discount_amount` + message lỗi cụ thể cho từng rule (status/expired/not started/usage limit/minimum/per-customer)
- [ ] **X** `promotion.service.calculateDiscount` — PERCENTAGE bị chặn bởi `max_discount`; discount không vượt subtotal
- [ ] **X** Nối promotion vào `/cart/preview` + `/orders` (đã mở sẵn ở W5)
- [ ] **X** module `reports` — 6 endpoint plan §2.15; `range` parser (today/7d/30d/this_month/custom); doanh thu chỉ `COMPLETED`; dùng `groupBy`/aggregate, không loop trong JS
- [ ] **X** Tests: mọi rule promotion (mỗi rule 1 case); report revenue chỉ đếm COMPLETED; `range=custom` thiếu date → 400; top-products đúng thứ tự

### Frontend — Claude
- [ ] **C** Admin Promotion list: filter status/active, pagination, hiển thị `used_count/usage_limit`
- [ ] **C** Admin Promotion create/edit: form + date range picker + validate type/value, toggle status, delete confirm
- [ ] **C** Customer: ô nhập voucher ở Cart + Checkout, hiện discount hoặc message lỗi từ API
- [ ] **C** Admin Dashboard: 4 KPI card (+ pending orders, low stock), range filter (today/7d/30d/this month/custom)
- [ ] **C** Chart: revenue theo day/month (line), orders theo day/month (bar), top products (bar/table), revenue by brand (pie/bar), order status (pie) — dùng thư viện chart đã có trong stack AntD (`@ant-design/plots`)
- [ ] **C** Low-stock table trên Dashboard (reuse W4a widget)
- [ ] **C** Reports page: export CSV client-side (optional)

### Gate W6 — Claude
- [ ] **C** So số Dashboard với query SQL tay trên cùng range → khớp
- [ ] **C** Test từng rule voucher trên UI, message hiển thị đúng
- [ ] **C** Không hard-code dữ liệu demo ở FE

---

## W7 — M10 Review + Hardening + Docs
*Dependency: W5 (cần order COMPLETED)*

### Backend — Codex
- [ ] **X** module `reviews` — list public (ẩn `is_hidden`) + summary rating breakdown, create (verify có order `COMPLETED` chứa product → 403 nếu không), update của mình, admin list/visibility/delete
- [ ] **X** `@@unique(product_id, customer_id)` → review lần 2 trả 409
- [ ] **X** Hardening: helmet config, CORS chặt theo env, rate limit, request size limit, không log secret, Prisma error mapping đầy đủ
- [ ] **X** Hoàn thiện test suite: **TC01–TC09** đủ, coverage service ≥ 80%, `order.service` + `inventory.service` 100% nhánh transition/stock
- [ ] **X** `backend/README.md` — install, env, migrate, seed, test
- [ ] **X** Postman collection / `tests/http/*.http` khớp plan §2

### Frontend — Claude
- [ ] **C** Customer Product detail: review summary (average + breakdown), review list (pagination), form review (chỉ hiện khi đã mua), edit review của mình
- [ ] **C** Admin Review moderation: list filter product/rating/hidden, ẩn/hiện, delete confirm
- [ ] **C** Rà soát toàn bộ màn hình: đủ loading / empty / error / success notification; action nguy hiểm có confirm
- [ ] **C** Responsive pass (mobile customer site, admin table scroll)
- [ ] **C** Vitest FE cho guard + cart + form validation; `npm run build` sạch
- [ ] **C** `README.md` root: kiến trúc, cách chạy local, tài khoản demo, Installation Guide, User Guide
- [ ] **C** `docs/api.md` (hoặc Swagger) sinh từ plan §2; `docs/test-report.md`; ERD export

### Gate W7 — Claude
- [ ] **C** `backend: lint + test` và `frontend: lint + build + test` đều xanh — báo output thật
- [ ] **C** Chạy lại full MVP flow §9 lần 2
- [ ] **C** Code review cuối: ranh giới layer, không duplicate logic, không secret trong repo, `.env` không bị commit
- [ ] **C** Checklist hoàn thành feature (CLAUDE.md §10) cho từng module

---

## Deploy (sau W7, theo OD-12)
- [ ] **X** Backend → Render/Railway + MySQL cloud, chạy migrate + seed
- [ ] **C** Frontend → Vercel, set `VITE_API_BASE_URL`
- [ ] **C** Verify flow MVP trên môi trường online
