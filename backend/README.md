# Backend — Perfume Shop Management System

Node.js + Express + Prisma + MySQL. Kiến trúc layered: `Route → Middleware → Controller → Service → Repository → DB`.

## Chạy local

```bash
# 1. MySQL (từ thư mục gốc repo)
docker compose up -d          # MySQL 8.4 ở localhost:3307

# 2. Env
cp .env.example .env          # điền JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, SEED_PASSWORD
                              # sinh secret: openssl rand -hex 32

# 3. Dependencies + schema + dữ liệu mẫu
npm install
npx prisma migrate dev
npm run seed

# 4. Chạy
npm run dev                   # http://localhost:4000
curl http://localhost:4000/api/v1/health
```

## Scripts

| Script | Việc |
|---|---|
| `npm run dev` | Dev server (nodemon) |
| `npm start` | Chạy production |
| `npm run lint` | ESLint |
| `npm test` | Jest + Supertest trên DB `perfume_shop_test` |
| `npm run db:migrate:test` | Áp migration lên DB test |
| `npm run seed` | Seed idempotent — chạy lại không nhân bản dữ liệu |
| `npm run prisma:studio` | Prisma Studio |

## Tài khoản seed

| Email | Role |
|---|---|
| `admin@perfume.local` | ADMIN |
| `staff@perfume.local` | STAFF |
| `customer@perfume.local` | CUSTOMER |

Mật khẩu = `SEED_PASSWORD` trong `.env`.

## Cấu trúc

```
src/
├── config/      env.js (validate + fail-fast), database.js (Prisma singleton)
├── modules/     1 thư mục / module: route, validation, controller, service, repository
├── middleware/  validation (zod), error (global handler + map lỗi Prisma)
├── utils/       AppError, response envelope, pagination, slug, asyncHandler
├── routes/      mount module vào /api/v1
└── app.js       helmet, cors theo env, static /uploads, 404 + error handler
```

## Quy ước

- Mọi response theo envelope `{ success, message, data, meta? }` — xem `../implementation_plan.md` §2.
- Lỗi dự đoán được: `throw AppError.<kind>(...)`, không `res.status()` rải rác.
- Danh sách luôn pagination; sort chỉ nhận field trong whitelist.
- Tiền dùng `Decimal(12,2)`, serialize ra string.
- Mọi thay đổi `stock_quantity` phải ghi `inventory_transactions` trong cùng `$transaction`.
- Thêm env mới → cập nhật `.env.example`. Không commit `.env`.

## Database

| DB | Dùng cho |
|---|---|
| `perfume_shop` | dev |
| `perfume_shop_test` | `npm test` |
| `perfume_shop_shadow` | Prisma Migrate diff schema |

Reset sạch: `docker compose down -v && docker compose up -d` rồi migrate + seed lại.
