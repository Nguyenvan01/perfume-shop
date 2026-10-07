# Hướng dẫn triển khai

Kiến trúc triển khai theo CLAUDE.md §1:

```text
Frontend  → Vercel
Backend   → Render hoặc Railway
Database  → MySQL cloud (Railway / Aiven / PlanetScale…)
Ảnh       → Cloudinary (đổi STORAGE_DRIVER, không sửa code)
```

---

## 1. Database

Tạo một MySQL instance (8.0+) trên nhà cung cấp bạn chọn, lấy connection string:

```text
mysql://<user>:<password>@<host>:<port>/<database>
```

Chạy migration và seed **một lần** từ máy bạn, trỏ vào DB cloud:

```bash
cd backend
DATABASE_URL="mysql://..." npx prisma migrate deploy
DATABASE_URL="mysql://..." SEED_PASSWORD="<mật khẩu mạnh>" npm run seed
```

> `prisma migrate deploy` chỉ áp migration đã commit, không tự sinh migration mới —
> đúng thứ cần cho production.
>
> Nhà cung cấp nào không cho tạo database phụ thì bỏ `SHADOW_DATABASE_URL`;
> biến này chỉ cần cho `migrate dev` ở máy local.

---

## 2. Backend (Render / Railway)

| Cấu hình | Giá trị |
|---|---|
| Root directory | `backend` |
| Build command | `npm ci && npx prisma generate` |
| Start command | `npm start` |
| Health check path | `/api/v1/health` |

Biến môi trường cần đặt:

```text
NODE_ENV=production
PORT=<nền tảng tự cấp, thường là 10000>
DATABASE_URL=mysql://...
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32 — khác secret trên>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
CORS_ORIGIN=https://<tên-app>.vercel.app
LOW_STOCK_THRESHOLD=5
DEFAULT_SHIPPING_FEE=30000
REPORT_TIMEZONE_OFFSET=7
STORAGE_DRIVER=cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

**Ba điểm dễ sai:**

1. **`CORS_ORIGIN` phải là domain Vercel thật**, không để `localhost`. Backend chặn mọi
   origin ngoài danh sách này và trả 403.
2. **`STORAGE_DRIVER=local` không dùng được trên Render/Railway** — filesystem của chúng
   là ephemeral, ảnh upload mất sau mỗi lần deploy. Phải chuyển sang `cloudinary`.
   Code module ảnh không cần sửa gì, chỉ đổi env.
3. **`JWT_ACCESS_SECRET` và `JWT_REFRESH_SECRET` phải khác nhau.** Dùng chung thì access
   token có thể được đem đi refresh.

App tự `app.set('trust proxy', 1)` khi `NODE_ENV=production` để rate limit đọc được IP
thật từ `X-Forwarded-For` thay vì IP của proxy.

---

## 3. Frontend (Vercel)

| Cấu hình | Giá trị |
|---|---|
| Root directory | `frontend` |
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |

Biến môi trường:

```text
VITE_API_BASE_URL=https://<backend-domain>/api/v1
```

**Cần rewrite cho SPA** — không có thì F5 ở `/admin/orders` sẽ ra 404. Tạo
`frontend/vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## 4. Kiểm tra sau khi deploy

```bash
# 1. Backend sống và nối được DB
curl https://<backend-domain>/api/v1/health
# kỳ vọng: {"success":true,...,"data":{"status":"ok","db":"up",...}}

# 2. CORS đúng domain frontend
curl -s -D - -o /dev/null -H "Origin: https://<frontend-domain>" \
  https://<backend-domain>/api/v1/health | grep -i access-control-allow-origin

# 3. Đăng nhập được
curl -s -X POST https://<backend-domain>/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@perfume.local","password":"<SEED_PASSWORD>"}'

# 4. Dữ liệu seed đã có
curl -s "https://<backend-domain>/api/v1/products?limit=3"
```

Rồi mở frontend và chạy lại luồng nghiệp vụ đầy đủ: đăng nhập admin → tạo sản phẩm →
nhập kho → khách đặt hàng → admin xử lý tới *Hoàn thành* → kiểm tra Dashboard cập nhật.

---

## 5. Việc phải làm ngay sau deploy

- **Đổi mật khẩu 3 tài khoản seed.** `admin@perfume.local` và `staff@perfume.local` dùng
  chung `SEED_PASSWORD`; ai đọc được repo cũng biết email. Đăng nhập rồi đổi mật khẩu ngay.
- **Xoá hoặc khoá tài khoản `customer@perfume.local`** nếu không cần cho demo.
- **Kiểm tra `.env` không bị commit** — `.gitignore` đã chặn, nhưng xác nhận lại:
  `git log --all --full-history -- '*/.env'` phải không ra gì.

---

## 6. Hạn chế đã biết của bản này

Ghi lại để không ai nhầm là lỗi:

- **Chưa có HTTPS redirect / HSTS** ở tầng app — dựa vào nền tảng (Vercel và Render đều
  bắt buộc HTTPS mặc định).
- **Rate limit lưu trong memory**, nên khi scale nhiều instance thì mỗi instance đếm
  riêng. Muốn chính xác thì cần store dùng chung (Redis).
- **Chưa gửi email thật** cho quên mật khẩu. Ở production endpoint trả 200 rỗng, nên
  tính năng này chưa dùng được trên môi trường thật — cần cắm SMTP hoặc Resend.
- **Chưa có thanh toán online.** Chỉ COD và chuyển khoản, trạng thái thanh toán do
  nhân viên cập nhật tay.
- **Chưa có backup DB tự động.** Bật tính năng backup của nhà cung cấp.
