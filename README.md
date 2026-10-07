# Perfume Shop Management System

Hệ thống quản lý shop nước hoa: website cho khách hàng + Admin Portal cho quản trị viên/nhân viên.

Trọng tâm là **nghiệp vụ quản lý**, không chỉ là website bán hàng:

- Quản lý sản phẩm theo **biến thể dung tích** (30ml / 60ml / 100ml…), mỗi biến thể một **SKU** riêng
- Quản lý **nhập – xuất – tồn** với lịch sử `inventory_transaction` đầy đủ, không bao giờ để tồn kho âm
- Quản lý **vòng đời đơn hàng** theo state machine, giá được snapshot tại thời điểm đặt
- **Phân quyền** 3 role: ADMIN / STAFF / CUSTOMER (RBAC + permission)
- **Dashboard & báo cáo** lấy từ dữ liệu thật trong database

---

## Tech stack

| Layer | Công nghệ |
|---|---|
| Frontend | React (Vite), Ant Design, React Router, Axios, TanStack Query |
| Backend | Node.js, Express, REST API, JWT (access + refresh), Prisma ORM |
| Database | MySQL 8.4 (Docker Compose) |
| Image storage | Local disk adapter → Cloudinary (đổi bằng env, không sửa code) |
| Test | Backend: Jest + Supertest · Frontend: Vitest + React Testing Library |

---

## Kiến trúc

```text
┌──────────────────────────────┐
│  Customer site  │  Admin     │   React + Ant Design
└──────────────┬───────────────┘
               │  REST /api/v1
┌──────────────▼───────────────┐
│  Route → Middleware →        │   Express (layered)
│  Controller → Service →      │   auth · validation · error handler
│  Repository                  │
└──────┬────────────────┬──────┘
       ▼                ▼
┌─────────────┐  ┌─────────────┐
│   MySQL     │  │ File storage│
└─────────────┘  └─────────────┘
```

Nguyên tắc: route không chứa logic · controller không query DB · business logic ở service · query ở repository · mọi thao tác đụng stock/order chạy trong `prisma.$transaction`.

---

## Chạy local

Cần: Node.js 20+, Docker.

```bash
git clone https://github.com/Nguyenvan01/perfume-shop.git
cd perfume-shop

# 1. MySQL (tạo sẵn 3 DB: dev / test / shadow, ở port 3307)
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env
#   điền JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (openssl rand -hex 32) và SEED_PASSWORD
npm install
npx prisma migrate dev
npm run seed
npm run dev                      # http://localhost:4000

# 3. Frontend (terminal khác)
cd frontend
cp .env.example .env
npm install
npm run dev                      # http://localhost:5173
```

Kiểm tra backend đã sống:

```bash
curl http://localhost:4000/api/v1/health
# {"success":true,"message":"Service is healthy","data":{"status":"ok","db":"up",...}}
```

### Tài khoản seed

| Email | Role |
|---|---|
| `admin@perfume.local` | ADMIN |
| `staff@perfume.local` | STAFF |
| `customer@perfume.local` | CUSTOMER |

Mật khẩu = giá trị `SEED_PASSWORD` bạn đặt trong `backend/.env`.

### Reset sạch database

```bash
docker compose down -v && docker compose up -d
cd backend && npx prisma migrate dev && npm run seed
```

---

## Scripts

**Backend** (`cd backend`)

| Script | Việc |
|---|---|
| `npm run dev` | Dev server (nodemon) |
| `npm start` | Chạy production |
| `npm run lint` | ESLint |
| `npm test` | Jest + Supertest trên DB `perfume_shop_test` |
| `npm run db:migrate:test` | Áp migration lên DB test |
| `npm run seed` | Seed idempotent (chạy lại không nhân bản dữ liệu) |
| `npm run prisma:studio` | Prisma Studio |

**Frontend** (`cd frontend`)

| Script | Việc |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Build production |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

---

## Cấu trúc repository

```text
perfume-shop/
├── backend/
│   ├── src/
│   │   ├── config/        env.js (validate + fail-fast), database.js (Prisma singleton)
│   │   ├── modules/       1 thư mục / module: route, validation, controller, service, repository
│   │   ├── middleware/    validation (zod), error (global handler)
│   │   ├── utils/         AppError, response envelope, pagination, slug
│   │   ├── routes/        mount module vào /api/v1
│   │   └── app.js
│   ├── prisma/            schema.prisma, migrations/, seed.js
│   └── tests/             unit/ + integration/
├── frontend/
│   └── src/
│       ├── api/           nơi DUY NHẤT gọi HTTP (13 module, phủ toàn bộ endpoint)
│       ├── features/      theo domain (auth, products, orders…)
│       ├── layouts/       CustomerLayout, AdminLayout, AuthLayout
│       ├── routes/        router + guard theo role
│       ├── components/    component dùng chung (QueryBoundary, DataTable…)
│       └── utils/
├── docker-compose.yml     MySQL 8.4
├── CLAUDE.md              spec: stack, business rules, milestone (nguồn sự thật nghiệp vụ)
├── implementation_plan.md Prisma schema, API contract đầy đủ, orchestration wave, test strategy
└── task.md                checklist theo wave
```

---

## Tài liệu

| File | Nội dung |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Spec nghiệp vụ: stack, roles, business rules, milestone M1–M10 |
| [`implementation_plan.md`](./implementation_plan.md) | Prisma schema đầy đủ, **API contract cho mọi endpoint** (method/path/role/request/response/error), orchestration wave, testing strategy |
| [`task.md`](./task.md) | Checklist thi công theo wave |
| [`backend/README.md`](./backend/README.md) | Hướng dẫn riêng cho backend |

API contract trong `implementation_plan.md` §2 là **hợp đồng cứng** giữa frontend và backend — sửa contract trước, sửa code sau.

---

## API convention

Base URL `/api/v1`. Mọi response theo envelope:

```json
{ "success": true,  "message": "Success", "data": {}, "meta": { "page": 1, "limit": 10, "total": 0 } }
{ "success": false, "message": "Validation failed", "errors": [{ "field": "email", "message": "Email is invalid" }] }
```

Tiền trả về dạng string (`Decimal`), ngày tháng ISO-8601. `meta` chỉ có ở list endpoint.

---

## Tiến độ

| Wave | Milestone | Trạng thái |
|---|---|---|
| W1 | M1 Setup + M2 Schema | ✅ Xong — 23 model, migration, seed idempotent, `/health`, 3 layout, router |
| W2 | M3 Auth / User / Role / Permission | ✅ Xong — JWT access+refresh có rotation, RBAC, user/role CRUD, 101 test pass |
| W3 | M4 Catalog (brand, category, product, variant, image) | Kế tiếp |
| W4 | M5 Inventory ∥ M6 Customer | Chưa làm |
| W5 | M7 Cart & Order (**MVP end-to-end**) | Chưa làm |
| W6 | M8 Promotion + M9 Dashboard | Chưa làm |
| W7 | M10 Review + hardening + deploy | Chưa làm |

Chi tiết từng task: [`task.md`](./task.md).

---

## Business rules cốt lõi

- **Product không chứa dung tích / giá / stock** — những thứ đó thuộc `product_variants`, mỗi variant một SKU unique.
- **Mọi thay đổi stock** phải ghi `inventory_transactions` (IMPORT / EXPORT / SALE / RETURN / ADJUSTMENT) trong cùng DB transaction, kèm `stock_before` và `stock_after`. Stock không bao giờ < 0.
- **Order lifecycle:** `PENDING → CONFIRMED → PACKING → SHIPPING → COMPLETED`, ngoại lệ `CANCELLED` (từ PENDING/CONFIRMED) và `RETURNED` (từ COMPLETED). Chuyển trạng thái ngoài bảng này bị reject.
- **Giá được snapshot** vào `order_details` khi đặt hàng — đổi giá sản phẩm không làm thay đổi đơn cũ.
- **Doanh thu chỉ tính đơn `COMPLETED`.**

Đầy đủ: `CLAUDE.md` §7.

---

## Git convention

Branch: `feature/<name>`, `fix/<name>`, `refactor/<scope>`. Commit: `feat: ...`, `fix: ...`, `docs: ...`.
Không commit secret hoặc `.env`. Thêm env mới thì cập nhật `.env.example`.
