# Hướng dẫn triển khai (Vercel + Supabase)

Topology production:

```text
                 ┌──────────────────────────┐        ┌──────────────────────────────┐
Trình duyệt ───▶ │ Vercel project #1        │        │ Vercel project #2            │
                 │ frontend/ (Vite SPA)     │ ─────▶ │ backend/ (Express trong      │
                 │ https://<fe>.vercel.app  │  HTTPS │ 1 Serverless Function)       │
                 └──────────────────────────┘        │ https://<be>.vercel.app      │
                                                     └──────────────┬───────────────┘
                                                                    │
                                    ┌───────────────────────────────┴──────────────┐
                                    │ Supabase                                     │
                                    │  • PostgreSQL (pooler 6543 cho runtime,      │
                                    │    session pooler 5432 cho migrate/seed)     │
                                    │  • Storage bucket public cho ảnh (§7)        │
                                    └──────────────────────────────────────────────┘
```

- Hai project Vercel **độc lập**, cùng trỏ vào một Git repo, khác *Root Directory*.
- Không có server chạy liên tục: mỗi request vào backend chạy Express trong một
  Vercel Function (`backend/api/index.js`). Local dev vẫn dùng `npm run dev` (`src/server.js`).
- Migration **không** tự chạy khi deploy — chạy tay từ máy bạn (§3).

Thứ tự làm: **Supabase (DB + bucket) → migrate + seed → backend → frontend → cập nhật CORS → kiểm tra.**

---

## 1. Các file cấu hình đã có trong repo

| File | Vai trò |
|---|---|
| `backend/api/index.js` | Entry của Vercel Function — chỉ `module.exports = require('../src/app')`, không `listen` |
| `backend/vercel.json` | `framework: null`, `installCommand: npm ci --include=dev`, rewrite mọi path → `/api`, `regions: ["sin1"]`, `maxDuration: 30` |
| `backend/public/robots.txt` | Output tĩnh duy nhất của project backend (chặn crawler; tránh Vercel serve source như file tĩnh) |
| `backend/.vercelignore` | Không upload `tests/`, `uploads/`, `.env` lên Vercel |
| `frontend/.vercelignore` | Không upload `.env*` (trừ `.env.example`), `node_modules/`, `dist/`, `coverage/`, file test |
| `backend/package.json` → `postinstall` | `prisma generate` chạy sau mỗi lần install trên Vercel (tránh Prisma Client cũ do cache) |
| `frontend/vercel.json` | Preset Vite + SPA rewrite `/(.*) → /index.html` (F5 ở `/admin/orders` không ra 404) |

> **Vì sao `installCommand` có `--include=dev`:** `prisma` (CLI, cần cho `postinstall`) nằm ở
> `devDependencies`. Nếu bạn đặt `NODE_ENV=production` trong env của Vercel thì
> `npm ci` mặc định bỏ devDependencies → `prisma generate` không chạy được → build fail.

> **Region:** `backend/vercel.json` đặt `sin1` (Singapore). Đổi cho **cùng region với
> Supabase project** — function và DB khác châu lục thì mỗi query cộng thêm ~150–250 ms.

---

## 2. Supabase

1. Tạo project trên Supabase, chọn region gần người dùng (vd *Southeast Asia (Singapore)*).
   Ghi lại database password.
2. *Project Settings → Database → Connection string* lấy **hai** URL:

   | Biến | Loại | Port | Dùng cho |
   |---|---|---|---|
   | `DATABASE_URL` | **Transaction pooler** (Supavisor) | `6543` | Runtime trên Vercel |
   | `DIRECT_URL` | **Session pooler** (Supavisor, khuyên dùng) | `5432` | `prisma migrate deploy`, seed, Prisma Studio — chạy từ máy bạn (§3) |

   ```text
   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
   DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
   ```

   Cùng mẫu với `backend/.env.example`. Lưu ý hai URL pooler dùng user `postgres.<ref>`
   (có hậu tố project ref), khác host direct.

   - **Vì sao session pooler cho `DIRECT_URL`:** host direct `db.<ref>.supabase.co:5432`
     mặc định **chỉ có IPv6** trên Supabase — đa số mạng gia đình/văn phòng ở VN và nhiều
     CI chỉ có IPv4 nên `migrate deploy` sẽ treo/`P1001 Can't reach database server`.
     Session pooler (`aws-0-<region>.pooler.supabase.com:5432`) có IPv4 và giữ nguyên
     session (advisory lock, prepared statement) nên Prisma Migrate chạy được.
   - Chỉ dùng host direct (`postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres`)
     khi máy bạn có IPv6 hoặc project đã bật **IPv4 add-on** (trả phí).
   - **Không** dùng transaction pooler `6543` cho `DIRECT_URL`: Prisma Migrate cần session
     (advisory lock) — transaction mode làm migrate lỗi hoặc treo.

   - `pgbouncer=true`: tắt prepared statement của Prisma — bắt buộc khi đi qua pooler ở
     transaction mode, không có sẽ gặp lỗi `prepared statement "s0" already exists`.
   - `connection_limit=1`: mỗi function instance chỉ giữ 1 connection; nhiều instance chạy
     song song mà mỗi cái mở pool 10 connection sẽ làm cạn connection của Supabase.
   - Mật khẩu có ký tự đặc biệt (`@`, `#`, `/`…) phải URL-encode.
3. Tạo bucket ảnh theo **§7**.

---

## 3. Migrate + seed vào Supabase (chạy tay, một lần / mỗi lần có migration mới)

Chạy từ máy bạn, trong `backend/`. **Không** đưa lệnh migrate vào build của Vercel:
mỗi preview deployment sẽ đụng vào DB production, và lỗi migration giữa chừng sẽ làm
deploy fail lưng chừng.

```bash
cd backend
npm ci

# Biến chung cho cả 2 lệnh dưới (env.js fail-fast nếu thiếu JWT secret, kể cả khi seed).
export DATABASE_URL="<DIRECT_URL — port 5432>"   # seed/migrate đi thẳng DB, không qua pooler
export DIRECT_URL="<DIRECT_URL — port 5432>"
export JWT_ACCESS_SECRET=dummy JWT_REFRESH_SECRET=dummy-2   # chỉ để boot script, không phải secret thật

# 1. Áp migration đã commit (không sinh migration mới)
npx prisma migrate deploy

# 2. Seed roles/permissions/admin/staff/brand/category/product mẫu
SEED_PASSWORD="<mật khẩu mạnh>" npm run seed

# 3. (tuỳ chọn) xem dữ liệu
npx prisma studio
```

- Datasource trong `schema.prisma` phải có `directUrl = env("DIRECT_URL")` để
  `migrate deploy` dùng kết nối trực tiếp (thuộc phạm vi nhánh migrate PostgreSQL).
- Có migration mới: merge code → chạy lại bước 1 **trước** khi deployment mới nhận traffic
  (migration phải tương thích ngược với code đang chạy).
- Seed tạo ảnh placeholder SVG **trên đĩa máy bạn** (`backend/uploads/seed/...`), DB lưu
  URL tương đối `/uploads/...` → các ảnh seed này **không hiển thị** trên Vercel. Upload lại
  ảnh qua Admin (đi vào Supabase Storage) nếu cần ảnh cho demo.

---

## 4. Backend — Vercel project #1

*Add New → Project → Import repo*, rồi:

| Cấu hình | Giá trị |
|---|---|
| Root Directory | `backend` |
| Framework Preset | **Other** (đã khoá bằng `"framework": null` trong `vercel.json`) |
| Install / Build / Output | Để mặc định — lấy từ `backend/vercel.json` |
| Node.js Version | 20.x hoặc 22.x |

### Biến môi trường (Production; Preview nếu dùng)

| Biến | Bắt buộc | Giá trị / ghi chú |
|---|---|---|
| `NODE_ENV` | nên có | `production` (bật `trust proxy`, log `combined`, Prisma chỉ log `error`) |
| `DATABASE_URL` | ✅ | Pooler `6543` + `?pgbouncer=true&connection_limit=1` (§2) |
| `DIRECT_URL` | không cần | Runtime không dùng: `src/config/env.js` tự đặt `DIRECT_URL = DATABASE_URL` (và ghi vào `process.env`) **trước** khi tạo Prisma Client, nên `directUrl = env("DIRECT_URL")` trong schema luôn có giá trị. `prisma generate` (`postinstall`) cũng không đọc biến này. Chỉ cần khi chạy `migrate deploy` từ máy bạn (§3). Nếu vẫn đặt thì dùng session pooler `5432`, **không** dùng `6543` |
| `JWT_ACCESS_SECRET` | ✅ | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | ✅ | `openssl rand -hex 32` — **khác** access secret |
| `JWT_ACCESS_EXPIRES` | | `15m` |
| `JWT_REFRESH_EXPIRES` | | `7d` |
| `CORS_ORIGIN` | ✅ | Domain frontend, vd `https://perfume-shop.vercel.app`. Nhiều origin cách nhau dấu phẩy. Wildcard cho preview: xem **CORS và preview deployment** bên dưới |
| `STORAGE_DRIVER` | ✅ | `supabase` — để trống/`local` trên Vercel thì app **từ chối khởi động** |
| `SUPABASE_URL` | ✅ | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | service_role / secret key — **chỉ server** (§7) |
| `SUPABASE_STORAGE_BUCKET` | ✅ | vd `product-images` |
| `LOW_STOCK_THRESHOLD` | | `5` |
| `REPORT_TIMEZONE_OFFSET` | | `7` |
| `DEFAULT_SHIPPING_FEE` | | `30000` |
| `AGENT_*` | | Chỉ khi dùng multi-model agent (xem `docs/multi-model-agent.md`) |

Không cần đặt: `PORT` (Vercel không dùng `listen`), `VERCEL` (Vercel tự set), `DIRECT_URL`
(xem bảng trên), `SEED_PASSWORD`, `DATABASE_URL_TEST`, `SHADOW_DATABASE_URL`, `UPLOAD_DIR`,
`CLOUDINARY_*`.

> Đã kiểm tra với Prisma 6.19: `prisma generate` chạy được khi thiếu cả `DATABASE_URL` lẫn
> `DIRECT_URL`, và Prisma Client ở runtime không đòi `DIRECT_URL` (chỉ `migrate`/`db`/`studio`
> mới dùng `directUrl`). Dù vậy app không phụ thuộc điều đó — `env.js` luôn điền sẵn biến này.

### CORS và preview deployment

Backend bật `credentials: true`, và origin được phép thì đọc được response của API từ trình
duyệt người dùng. Wildcard phải hẹp tới mức chỉ deployment của bạn khớp.

- `*` chỉ được đặt trong **nhãn đầu tiên** của host và chỉ khớp chữ/số/`-` (không qua `.`,
  `/`, `:`), nên `https://x.vercel.app.evil.com` hay khác scheme/port đều bị chặn.
- Preview URL của Vercel có dạng `<project>-<hash>-<team-slug>.vercel.app` (URL theo
  nhánh: `<project>-git-<branch>-<team-slug>.vercel.app`). Dùng pattern **gắn với team**:

  ```text
  CORS_ORIGIN=https://perfume-shop.vercel.app,https://perfume-shop-*-<team-slug>.vercel.app
  ```

  Team slug là duy nhất trên Vercel nên phần đuôi `-<team-slug>` neo pattern vào team của
  bạn: `https://perfume-shop-x-abc123-evil.vercel.app` (project cùng tên ở team khác) không
  khớp; `https://evil-x-<team-slug>.vercel.app` (project khác trong team bạn) cũng không
  khớp vì thiếu prefix `perfume-shop-`.
- App **từ chối khởi động** (lỗi `Invalid CORS_ORIGIN entry ...`) nếu pattern quá rộng:
  - `*` chiếm cả nhãn ngay trên hậu tố dùng chung hoặc TLD: `https://*.vercel.app`,
    `*.netlify.app`, `*.pages.dev`, `*.github.io`, `*.onrender.com`, `https://*.com`, `*`;
  - prefix-only trên hậu tố dùng chung: `https://perfume-shop-*.vercel.app` — ai đặt tên
    project `perfume-shop-x` cũng nhận domain `perfume-shop-x.vercel.app` và khớp;
  - `*` ở scheme/port, ngoài nhãn đầu tiên, hoặc có path.

  Wildcard dưới domain **của riêng bạn** vẫn hợp lệ: `https://*.shop.example.com`,
  `https://*.<project>.pages.dev`.
- Pattern gắn team vẫn dựa vào cách Vercel đặt tên domain: về lý thuyết một tài khoản khác
  có thể đặt tên project kết thúc bằng `-<team-slug>` của bạn để nhận production domain
  `perfume-shop-…-<team-slug>.vercel.app`. Cần chặt tuyệt đối thì **chỉ liệt kê origin chính
  xác** (production + custom domain) và không mở CORS cho preview, hoặc trỏ preview vào
  backend preview/DB riêng.

Đổi env xong phải **Redeploy** — env chỉ được đọc lúc function khởi động.

### Prisma trên Vercel

- `postinstall: prisma generate` sinh client ngay trên máy build của Vercel. Build image và
  runtime Node của Vercel cùng Amazon Linux 2023 / OpenSSL 3, nên `binaryTargets` mặc định
  (`native` → `rhel-openssl-3.0.x`) là khớp — **không** cần thêm `binaryTargets` vào schema.
  Nếu log runtime báo `Query engine library for current platform "..." could not be found`
  thì mới thêm `binaryTargets = ["native", "rhel-openssl-3.0.x"]` vào generator.
- Prisma Client là singleton trên `globalThis` (`src/config/database.js`) → các request
  "warm" trên cùng instance dùng lại connection, không mở mới mỗi request.

---

## 5. Frontend — Vercel project #2

| Cấu hình | Giá trị |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite (đã khai báo trong `frontend/vercel.json`) |
| Build command | `npm run build` |
| Output directory | `dist` |

Biến môi trường:

| Biến | Bắt buộc | Giá trị |
|---|---|---|
| `VITE_API_BASE_URL` | ✅ | `https://<be>.vercel.app/api/v1` |

- Biến `VITE_*` được **nhúng lúc build** → đổi giá trị phải Redeploy frontend.
- Thiếu biến này ở production build: `vite build` in cảnh báo, và app **không** âm thầm
  gọi `localhost` — mỗi request bị chặn với thông báo "Ứng dụng chưa được cấu hình
  VITE_API_BASE_URL…" và console có `[config] …` (xem `src/api/baseUrl.js`).
- **Tuyệt đối không** đặt `SUPABASE_SERVICE_ROLE_KEY` hay secret nào vào biến `VITE_*`:
  mọi biến `VITE_*` đều lộ ra trình duyệt.

Sau khi frontend có domain → quay lại backend, đặt `CORS_ORIGIN` = domain đó → Redeploy backend.

---

## 6. Kiểm tra sau khi deploy

### Smoke test bằng curl

```bash
BE=https://<be>.vercel.app
FE=https://<fe>.vercel.app

# 1. Backend sống và nối được DB
curl -s $BE/api/v1/health
# kỳ vọng: {"success":true,...,"data":{"status":"ok","db":"up",...}}
# "db":"down" → sai DATABASE_URL / thiếu pgbouncer=true / Supabase project đang pause

# 2. CORS trả đúng origin frontend
curl -s -D - -o /dev/null -H "Origin: $FE" $BE/api/v1/health | grep -i access-control-allow-origin

# 3. Origin lạ bị chặn (403)
curl -s -o /dev/null -w '%{http_code}\n' -H "Origin: https://evil.example" $BE/api/v1/health

# 4. Đăng nhập được (TC01)
curl -s -X POST $BE/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@perfume.local","password":"<SEED_PASSWORD>"}'

# 5. Sai mật khẩu → 401 (TC02)
curl -s -o /dev/null -w '%{http_code}\n' -X POST $BE/api/v1/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"admin@perfume.local","password":"wrong"}'

# 6. Dữ liệu seed đã có
curl -s "$BE/api/v1/products?limit=3"

# 7. SPA rewrite: F5 ở route sâu không ra 404
curl -s -o /dev/null -w '%{http_code}\n' $FE/admin/orders   # kỳ vọng 200
```

### Checklist luồng MVP (CLAUDE.md §9) trên bản deploy

- [ ] Admin đăng nhập trên frontend
- [ ] Tạo Brand → tạo Category
- [ ] Tạo Product → tạo Variants (SKU unique) → upload ảnh (ảnh hiện URL `…supabase.co/storage/…`)
- [ ] Nhập kho (IMPORT) → tồn kho tăng, có lịch sử transaction
- [ ] Customer đăng ký / đăng nhập → duyệt / tìm / lọc sản phẩm
- [ ] Thêm vào giỏ; thử quantity > stock → bị từ chối (TC04)
- [ ] Checkout hợp lệ → đơn tạo, stock giảm, có transaction `SALE` (TC06, TC07)
- [ ] Admin: Xác nhận → PACKING → SHIPPING → COMPLETED; thử chuyển sai thứ tự → bị từ chối (TC08)
- [ ] Dashboard: doanh thu/đơn hôm nay cập nhật theo đơn `COMPLETED`
- [ ] Đăng nhập STAFF → gọi API quản lý role → 403 (TC09)
- [ ] F5 ở `/admin/orders`, `/products/<slug>` vẫn render (SPA rewrite)

---

## 7. Ảnh — Supabase Storage (`STORAGE_DRIVER=supabase`)

Backend chạy trên Vercel serverless **không có đĩa bền**, nên ảnh product/brand lưu ở
Supabase Storage. App **từ chối khởi động** nếu chạy trên Vercel (`VERCEL=1`) mà
`STORAGE_DRIVER=local` (kể cả khi bỏ trống biến này, vì mặc định là `local`).
Driver Cloudinary vẫn còn, đổi env là dùng được.

**Tạo bucket (một lần):**

1. Supabase Dashboard → **Storage** → **New bucket**, đặt tên (vd `product-images`),
   bật **Public bucket**. Bucket public = ai có URL đều *đọc* được ảnh; *ghi/xóa* vẫn cần key.
2. Nên giới hạn trong cấu hình bucket: *Allowed MIME types* `image/jpeg, image/png, image/webp`
   và *File size limit* `2 MB` (khớp `upload.middleware.js`).
3. Không cần tạo policy RLS cho upload: backend dùng service role key, key này bỏ qua RLS.
   **Không** tạo policy cho phép `anon` ghi vào bucket.
4. Lấy **Project URL** và **service_role / secret key** ở *Project Settings → API*.

**Biến môi trường backend (Vercel → Project → Settings → Environment Variables):**

```text
STORAGE_DRIVER=supabase
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role / secret key>
SUPABASE_STORAGE_BUCKET=product-images
```

Thiếu một trong ba biến `SUPABASE_*` → app fail khi boot, message chỉ nêu *tên* biến thiếu.

- `SUPABASE_URL` phải là **gốc project, https**: không path, query, fragment hay
  `user:pass@`. `http://localhost` / `http://127.0.0.1` chỉ được nhận khi
  `NODE_ENV` khác `production` (Supabase CLI chạy local).
- `SUPABASE_SERVICE_ROLE_KEY` nhận cả hai loại key:
  - key mới `sb_secret_...` (khuyên dùng): không phải JWT, driver chỉ gửi qua header `apikey`;
  - key legacy `service_role` (JWT `eyJ...`): driver gửi qua `apikey` và `Authorization: Bearer`.

**Service role key chỉ ở server:**

- Không bao giờ đặt nó vào biến `VITE_*` hay env nào của frontend — key này có toàn
  quyền trên project (bỏ qua RLS).
- Driver không log key; lỗi từ Supabase chỉ trả `502 Storage upload failed (<status>)`,
  không chuyển tiếp body lỗi của Supabase.
- Lộ key → rotate ngay ở *Project Settings → API* rồi cập nhật env trên Vercel.

**URL ảnh:** object lưu tại `<folder>/<uuid>.<ext>` (folder `products` hoặc `brands`);
`public_id` trong DB chính là đường dẫn này. API trả URL tuyệt đối dạng
`https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>/products/<uuid>.webp`,
frontend (`resolveImageUrl`) dùng thẳng URL tuyệt đối nên không cần đổi gì.

> Ảnh cũ upload bằng driver khác (`/uploads/...` hoặc Cloudinary) không tự chuyển sang
> Supabase. Ảnh local sẽ không hiển thị trên Vercel — upload lại qua Admin nếu cần.

**Giới hạn kích thước request:** Vercel Function nhận body tối đa **4.5 MB**/request
(vượt → Vercel trả `413 FUNCTION_PAYLOAD_TOO_LARGE` trước khi tới Express, không có header
CORS). Backend cho phép 5 ảnh × 2 MB = 10 MB/request, nên frontend
(`productImagesApi.upload`) tự chia file thành nhiều request tuần tự, mỗi request ≤ 4 MB
(`src/utils/uploadBatches.js`). Client khác (Postman, script) gọi thẳng API cũng phải
tự giữ mỗi request ≤ 4.5 MB.

- **Lỗi giữa chừng:** batch nào lên xong thì ảnh đó đã lưu trên server. Trang Admin bỏ ngay
  các file của batch thành công khỏi hàng chờ (theo `uid` của AntD, không theo tên file) và
  báo "Đã lưu X/Y ảnh…" — bấm tải lên lần nữa chỉ gửi phần còn lại, không tạo ảnh trùng.
- **413 không đọc được từ frontend:** frontend và backend khác origin, mà response 413 của
  Vercel không có header CORS → trình duyệt chỉ thấy *network error*. Vì vậy request
  `FormData` mất response được báo "Không gửi được file lên server. Có thể dữ liệu vượt giới
  hạn dung lượng…" thay vì "mất kết nối" chung chung (`src/api/client.js`).

---

## 8. Việc phải làm ngay sau deploy

- **Đổi mật khẩu 3 tài khoản seed.** `admin@perfume.local` và `staff@perfume.local` dùng
  chung `SEED_PASSWORD`; ai đọc được repo cũng biết email. Đăng nhập rồi đổi mật khẩu ngay.
- **Xoá hoặc khoá tài khoản `customer@perfume.local`** nếu không cần cho demo.
- **Kiểm tra `.env` không bị commit** — `.gitignore` đã chặn, nhưng xác nhận lại:
  `git log --all --full-history -- '*/.env'` phải không ra gì.
- **Bật Point-in-Time Recovery / backup** của Supabase nếu gói cho phép.

---

## 9. Hạn chế đã biết (serverless)

Ghi lại để không ai nhầm là lỗi:

- **Rate limit lưu trong memory của từng function instance.** Vercel chạy nhiều instance
  song song và tắt instance khi rảnh, nên giới hạn 300 req/phút (60 ghi/phút) là *theo
  instance*, không phải toàn cục, và bị reset khi cold start. Đủ chặn spam thô; muốn chính
  xác cần store dùng chung (Redis/Upstash) — chưa làm.
- **IP client:** app bật `trust proxy = 1` khi `NODE_ENV=production` hoặc chạy trên Vercel.
  Vercel ghi đè `X-Forwarded-For` bằng IP thật của client, nên rate limit và log key theo IP
  thật. Nếu đặt thêm proxy/CDN khác phía trước Vercel thì phải chỉnh lại số hop.
- **Cold start:** request đầu sau một thời gian rảnh chậm hơn (~1–3 s: load Express +
  Prisma engine + mở connection). Supabase free tier còn **pause project sau 7 ngày không
  hoạt động** → health trả `db: down` cho tới khi bạn resume trên dashboard.
- **Thời gian tối đa mỗi request:** `maxDuration: 30` s (`backend/vercel.json`). Báo cáo/
  dashboard với dải ngày rất lớn hoặc agent gọi LLM chậm có thể bị cắt.
- **Body tối đa 4.5 MB/request** (xem §7).
- **Filesystem read-only** (trừ `/tmp`, không bền): không ghi file ở runtime. Driver `local`
  bị chặn khi boot; `express.static('/uploads')` chỉ mount khi `STORAGE_DRIVER=local` (dev).
  Log đi ra stdout (morgan) → xem ở *Vercel → Project → Logs*.
- **Connection DB:** mỗi instance 1 connection qua pooler (`connection_limit=1`). Transaction
  tương tác (`prisma.$transaction(async tx => …)` ở checkout/inventory) vẫn chạy được ở
  transaction mode vì cả transaction nằm trên một connection.
- **Chưa có HTTPS redirect / HSTS** ở tầng app — dựa vào Vercel (bắt buộc HTTPS mặc định).
- **Chưa gửi email thật** cho quên mật khẩu. Ở production endpoint trả 200 rỗng, nên
  tính năng này chưa dùng được trên môi trường thật — cần cắm SMTP hoặc Resend.
- **Chưa có thanh toán online.** Chỉ COD và chuyển khoản, trạng thái thanh toán do
  nhân viên cập nhật tay.
- **Chưa có backup DB tự động.** Bật tính năng backup của nhà cung cấp.
