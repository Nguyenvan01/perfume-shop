# API Documentation

Base URL: `/api/v1` · Cập nhật: 2026-10-07 (sau Wave 7) · **94 endpoint**

Hợp đồng chi tiết (request/response/DTO) nằm ở [`implementation_plan.md`](../implementation_plan.md) §2.
File này là bảng tra nhanh: endpoint nào, ai gọi được, trả gì.

---

## 1. Quy ước chung

### Envelope

```json
{ "success": true,  "message": "Success", "data": {}, "meta": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 } }
{ "success": false, "message": "Validation failed", "errors": [{ "field": "email", "message": "Email is invalid" }] }
```

- `meta` chỉ xuất hiện ở endpoint danh sách.
- Tiền trả về dạng **string** (`Decimal`), ví dụ `"1850000.00"` — client tự format.
- Ngày tháng theo **ISO-8601 UTC**.

### Xác thực

`Authorization: Bearer <accessToken>`. Access token sống 15 phút, refresh token 7 ngày và
**có rotation**: mỗi lần refresh thì token cũ bị thu hồi. Dùng lại token đã rotate sẽ
bị coi là dấu hiệu bị đánh cắp và **toàn bộ session của user bị thu hồi**.

### Mã lỗi

| HTTP | Khi nào |
|---|---|
| 400 | Validation fail (kèm `errors[]`), body JSON sai cú pháp |
| 401 | Thiếu / sai / hết hạn token |
| 403 | Thiếu quyền, hoặc truy cập dữ liệu của người khác |
| 404 | Không tìm thấy |
| 409 | Xung đột nghiệp vụ: trùng slug/SKU/email, chuyển trạng thái sai, còn ràng buộc |
| 410 | Token reset password đã dùng hoặc hết hạn |
| 413 | Body vượt 256KB |
| 422 | Vi phạm rule nghiệp vụ: hết hàng, mã giảm giá không dùng được |
| 429 | Vượt rate limit |
| 500 | Lỗi không lường trước |

### Phân trang & sắp xếp

`?page=1&limit=10&sort=created_at:desc&q=<từ khóa>`. `limit` tối đa **100**.
`sort` chỉ nhận field trong whitelist của từng module — field lạ bị bỏ qua, không gây lỗi.

### Rate limit

| Phạm vi | Giới hạn |
|---|---|
| Toàn API | 300 request / phút |
| Method ghi (POST/PUT/PATCH/DELETE) | 60 request / phút |
| `/auth/login`, `/auth/forgot-password` | 10 request / 5 phút |

---

## 2. Bảng endpoint

Ký hiệu quyền: **—** công khai · **C** customer · **S** staff · **A** admin

### Health (1)

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/health` | — | Trạng thái service + ping DB |

### Auth (9)

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| POST | `/auth/register` | — | Đăng ký khách; tạo user + hồ sơ khách + giỏ hàng trong 1 transaction |
| POST | `/auth/login` | — | Trả `accessToken`, `refreshToken`, `user` |
| POST | `/auth/refresh` | — | Rotation: thu hồi token cũ, phát cặp mới |
| POST | `/auth/logout` | C S A | Thu hồi refresh token |
| GET | `/auth/me` | C S A | Hồ sơ + `roles` + `permissions` |
| PUT | `/auth/me` | C S A | Sửa tên / điện thoại / địa chỉ |
| POST | `/auth/change-password` | C S A | Đổi mật khẩu, thu hồi toàn bộ session |
| POST | `/auth/forgot-password` | — | Luôn trả 200 (không tiết lộ email tồn tại). Dev trả `reset_token` |
| POST | `/auth/reset-password` | — | Đặt mật khẩu mới bằng token |

### Users (7) — ADMIN only

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/users` | A | `?q&role&status` |
| POST | `/users` | A | Tạo user + gán role |
| GET | `/users/:id` | A | |
| PUT | `/users/:id` | A | Sửa thông tin, thay toàn bộ role |
| PATCH | `/users/:id/status` | A | Khóa/mở; khóa thì thu hồi hết refresh token |
| PATCH | `/users/:id/reset-password` | A | |
| DELETE | `/users/:id` | A | Soft delete. Tự khóa/xóa chính mình → 409 |

### Roles & Permissions (6) — ADMIN only

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/roles` | A | Kèm `permissions[]` và `user_count` |
| POST | `/roles` | A | Tên phải UPPER_SNAKE_CASE |
| GET | `/roles/:id` | A | |
| PUT | `/roles/:id` | A | Thay **toàn bộ** permission (không merge) |
| DELETE | `/roles/:id` | A | Role hệ thống hoặc còn user → 409 |
| GET | `/permissions` | A | |

### Brands (6)

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/brands` | — | Khách chỉ thấy `ACTIVE`; token S/A thấy cả `INACTIVE` |
| GET | `/brands/:id` | — | |
| POST | `/brands` | S A | Slug tự sinh (bỏ dấu tiếng Việt), trùng thì thêm hậu tố |
| PUT | `/brands/:id` | S A | |
| POST | `/brands/:id/logo` | S A | `multipart`, field `files` |
| DELETE | `/brands/:id` | A | Soft delete. Còn sản phẩm → 409 |

### Categories (5)

Giống Brands, không có logo.

### Products (5)

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/products` | — | `?q&brand_id&category_id&gender&concentration&min_price&max_price&in_stock&status&sort` |
| GET | `/products/:id` | — | `:id` nhận **id số hoặc slug** |
| POST | `/products` | S A | Tạo kèm `variants[]`; stock luôn bắt đầu 0 |
| PUT | `/products/:id` | S A | Không sửa variants qua đây |
| DELETE | `/products/:id` | A | Soft delete |

`ProductDTO` không có `price`/`stock_quantity` — thay bằng `price_range` và `total_stock`
tính từ variants.

> Giới hạn đã biết: `sort=price:asc|desc` chỉ sắp xếp **trong trang hiện tại**
> (giá nằm ở bảng `product_variants`, sort toàn cục cần raw SQL).

### Product Variants (5)

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/products/:productId/variants` | — | |
| POST | `/products/:productId/variants` | S A | SKU unique toàn hệ thống; trùng dung tích trong cùng sản phẩm → 409 |
| GET | `/variants/:id` | — | |
| PUT | `/variants/:id` | S A | **Không** sửa được `stock_quantity` |
| DELETE | `/variants/:id` | A | Đã có lịch sử kho / đã bán / còn tồn → 409 |

### Product Images (4)

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/products/:productId/images` | — | |
| POST | `/products/:productId/images` | S A | `multipart` field `files`, ≤5 file, ≤2MB, chỉ JPG/PNG/WEBP |
| PATCH | `/products/:productId/images/:imageId/primary` | S A | |
| DELETE | `/products/:productId/images/:imageId` | S A | Xóa cả file ở storage |

> SVG bị từ chối: file upload được serve cùng origin nên SVG có thể chứa script.

### Inventory (7) — ADMIN/STAFF

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/inventory` | S A | `?q&brand_id&category_id&low_stock&out_of_stock&status` |
| GET | `/inventory/summary` | S A | Tổng biến thể, tổng tồn, sắp hết, hết hàng, giá trị kho |
| GET | `/inventory/low-stock` | S A | |
| GET | `/inventory/transactions` | S A | `?variant_id&type&from&to` |
| POST | `/inventory/import` | S A | Nhiều dòng, 1 transaction; một dòng fail → cả phiếu rollback |
| POST | `/inventory/export` | S A | Vượt tồn → 422 |
| POST | `/inventory/adjustment` | **A** | `note` bắt buộc; ghi **delta** chứ không ghi số tuyệt đối |

### Customers (4) — ADMIN/STAFF

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/customers` | S A | `?q&status&sort=total_spending:desc` |
| GET | `/customers/:id` | S A | Kèm `recent_orders` và `order_status_counts` |
| GET | `/customers/:id/orders` | S A | |
| PATCH | `/customers/:id/status` | **A** | Ghi vào `users.status` + thu hồi refresh token |

### Cart (6) — CUSTOMER only

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/cart` | C | Tự tạo giỏ nếu chưa có; kèm `warnings[]` cho dòng có vấn đề |
| POST | `/cart/items` | C | Trùng variant thì **cộng dồn**; tổng sau cộng > tồn kho → 422 |
| PUT | `/cart/items/:itemId` | C | Vượt tồn kho → 422; dòng của người khác → 403 |
| DELETE | `/cart/items/:itemId` | C | |
| DELETE | `/cart` | C | Xóa cả giỏ |
| POST | `/cart/preview` | C | Tính `subtotal`/`discount_amount`/`shipping_fee`/`total_amount` ở backend |

### Orders (9)

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| POST | `/orders` | C | Checkout trong 1 transaction |
| GET | `/orders/my` | C | |
| GET | `/orders` | S A | `?q&status&from&to&customer_id` |
| GET | `/orders/:id` | C (của mình) S A | Khách xem đơn người khác → 403 |
| PATCH | `/orders/:id/cancel` | C (`PENDING`) S A (`PENDING`/`CONFIRMED`) | Hoàn kho + nhả lượt mã giảm giá |
| PATCH | `/orders/:id/status` | S A | Chuyển ngoài bảng → 409 |
| PATCH | `/orders/:id/return` | **A** | Chỉ từ `COMPLETED`; hoàn kho, tính lại tổng chi tiêu khách |
| PATCH | `/orders/:id/payment` | S A | |
| GET | `/orders/:id/invoice` | S A | |

**Vòng đời đơn** — chuyển ngoài bảng này bị từ chối:

```text
PENDING   → CONFIRMED | CANCELLED
CONFIRMED → PACKING   | CANCELLED
PACKING   → SHIPPING
SHIPPING  → COMPLETED
COMPLETED → RETURNED
CANCELLED → ∅     RETURNED → ∅
```

`OrderDTO` trả kèm `allowed_transitions` — frontend chỉ hiện nút theo danh sách này,
không tự suy luận.

### Promotions (7)

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| POST | `/promotions/validate` | **C** | Xem trước tiền giảm; message lỗi cụ thể từng rule |
| GET | `/promotions` | S A | `?q&status&active_only`; trả `effective_state` |
| GET | `/promotions/:id` | S A | Kèm `usages_count` |
| POST | `/promotions` | **A** | |
| PUT | `/promotions/:id` | **A** | Validate chéo với giá trị đang lưu |
| PATCH | `/promotions/:id/status` | **A** | |
| DELETE | `/promotions/:id` | **A** | Đã có đơn dùng → 409, gợi ý tắt thay vì xóa |

`effective_state`: `RUNNING` · `SCHEDULED` · `EXPIRED` · `EXHAUSTED` · `INACTIVE`

### Reviews (6)

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/products/:productId/reviews` | — | Kèm `summary` (điểm trung bình + phân bố 5 bậc) |
| GET | `/products/:productId/reviews/eligibility` | C | `can_review` + `reason` + `my_review` |
| POST | `/products/:productId/reviews` | C | Chưa mua → 403; đánh giá lần 2 → 409 |
| PUT | `/reviews/:id` | C (của mình) | Review đã bị ẩn → 409 |
| GET | `/reviews` | S A | `?product_id&rating&is_hidden` |
| PATCH | `/reviews/:id/visibility` | **A** | Ẩn thì không tính vào điểm trung bình |
| DELETE | `/reviews/:id` | **A** | |

### Reports (6) — ADMIN/STAFF

Mọi endpoint nhận `?range=today|7d|30d|this_month|custom` (+ `from`/`to` khi `custom`).

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/reports/dashboard` | S A | KPI + `revenue_change_pct` so kỳ trước |
| GET | `/reports/revenue` | S A | `?group_by=day|month` |
| GET | `/reports/top-products` | S A | `?limit` (1–50) |
| GET | `/reports/revenue-by-brand` | S A | Kèm `share_pct` |
| GET | `/reports/order-status` | S A | Đủ 7 trạng thái kể cả count 0 |
| GET | `/reports/low-stock` | S A | `?limit` |

**Hai cơ sở tính doanh thu khác nhau — có chủ ý:**

- `dashboard.revenue` cộng `orders.total_amount`: tiền thực thu, **đã gồm** phí ship,
  đã trừ giảm giá. Field `revenue_basis = order_total_including_shipping`.
- `revenue-by-brand` cộng `order_details.line_total`: tiền **hàng**, không gồm phí ship
  và giảm giá toàn đơn (hai khoản này không thuộc thương hiệu nào).
  Field `basis = product_revenue_excluding_shipping_and_discount`.

**Múi giờ:** báo cáo tính theo ngày giờ **Việt Nam (UTC+7)**, cấu hình qua
`REPORT_TIMEZONE_OFFSET`. Tính theo UTC thì "doanh thu hôm nay" lệch 7 tiếng mỗi ngày.

---

## 3. Thử nhanh bằng curl

```bash
# Đăng nhập
TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@perfume.local","password":"<SEED_PASSWORD>"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["accessToken"])')

# Danh sách sản phẩm (công khai)
curl -s http://localhost:4000/api/v1/products?limit=2

# Tồn kho (cần quyền)
curl -s http://localhost:4000/api/v1/inventory -H "Authorization: Bearer $TOKEN"

# Dashboard
curl -s "http://localhost:4000/api/v1/reports/dashboard?range=30d" -H "Authorization: Bearer $TOKEN"
```
