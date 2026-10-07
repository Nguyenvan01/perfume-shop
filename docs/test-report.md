# Test Report — Perfume Shop Management System

Cập nhật: 2026-10-07 · sau Wave 6 (Promotion + Dashboard/Report)

## 1. Tổng quan

| Lớp | Công cụ | Số test | Kết quả |
|---|---|---|---|
| Backend unit + integration | Jest + Supertest (DB `perfume_shop_test`) | 288 | ✅ pass |
| Frontend unit + component | Vitest + React Testing Library | 82 | ✅ pass |
| **Tổng** | | **370** | ✅ pass |

Lint: `backend: eslint src prisma tests` và `frontend: eslint src` đều sạch.
Build: `frontend: vite build` thành công.

## 2. Test case bắt buộc (CLAUDE.md §9)

| ID | Scenario | Expected | Kết quả | Nơi kiểm chứng |
|---|---|---|---|---|
| TC01 | Login đúng thông tin | Success | ✅ 200, trả accessToken + roles | `tests/integration/auth.test.js` |
| TC02 | Sai password | Error 401 | ✅ 401 `Invalid credentials`, không trả token | `auth.test.js` |
| TC03 | Tạo product hợp lệ | Created | ✅ 201, DTO có brand/category/price_range | `catalog.test.js` |
| TC04 | Cart quantity > stock | Rejected | ✅ 422, giỏ không đổi (cả khi cộng dồn) | `cart.test.js` |
| TC05 | Checkout khi hết hàng | Rejected | ✅ 422, không tạo đơn, kho nguyên vẹn | `order.test.js` |
| TC06 | Checkout hợp lệ | Order created | ✅ 201, PENDING, snapshot giá, giỏ được xóa | `order.test.js` |
| TC07 | Sau checkout | Stock giảm + có transaction SALE | ✅ `SALE -3`, `10 → 7`, `reference=ORDER:n` | `order.test.js` |
| TC08 | Chuyển status sai thứ tự | Rejected | ✅ 409 `Invalid status transition PENDING → SHIPPING` | `order.test.js` |
| TC09 | STAFF gọi API quản lý role | 403 | ✅ 403 ở `/roles`, `/users`, `/permissions` | `users.test.js` |

## 3. MVP acceptance flow (CLAUDE.md §9)

Chạy end-to-end trên server thật với DB thật, không mock:

```text
Admin login → tạo Brand → tạo Category → tạo Product + 2 Variants → Nhập kho (20 + 10)
→ Khách đăng ký → browse sản phẩm → thêm vào giỏ → preview + áp mã WELCOME10
→ Đặt hàng (PS20261007-00001) → Admin CONFIRMED → PACKING → SHIPPING → COMPLETED
→ Tổng chi tiêu khách cập nhật
```

Kết quả quan sát được:

| Bước | Quan sát |
|---|---|
| Tạo variant | Tồn kho khởi tạo = 0 (stock chỉ đổi qua module kho) |
| Nhập kho | `MVP-W5-50: 0 → 20`, `MVP-W5-100: 0 → 10`, mỗi dòng một transaction IMPORT |
| Thêm giỏ vượt tồn | 422 `Quantity exceeds available stock: 10 left` |
| Preview mã giảm | Tạm tính 6.600.000 − giảm 500.000 + ship 30.000 = **6.130.000** (PERCENTAGE bị chặn bởi `max_discount`) |
| Đặt hàng | Mã `PS20261007-00001`, status `PENDING`, snapshot `MVP-W5-100 / 2.200.000 × 3` |
| Sau đặt hàng | Kho `10 → 7`, transaction `SALE -3` với `reference=ORDER:1`, giỏ hàng trống |
| Chuyển status sai | `PENDING → SHIPPING` = 409 |
| Vòng đời đúng | CONFIRMED → PACKING → SHIPPING → COMPLETED, `allowed_transitions` thu hẹp đúng từng bước |
| Hoàn thành đơn | `payment: PAID`, `completed_at` được set |
| Số liệu khách | `total_orders=1`, `total_spending=6.130.000` |

## 4. Bất biến dữ liệu (kiểm tra bằng SQL trên DB thật)

| Bất biến | Truy vấn | Kết quả |
|---|---|---|
| Tồn kho khớp lịch sử | `stock_quantity` vs `SUM(inventory_transactions.quantity)` theo variant | **0 variant lệch** |
| Tồn kho không âm | `COUNT(*) WHERE stock_quantity < 0` | **0** |
| Đơn luôn có payment | `orders LEFT JOIN payments WHERE payments.id IS NULL` | **0** |
| Đơn luôn có chi tiết | `orders LEFT JOIN order_details WHERE order_details.id IS NULL` | **0** |
| Tổng chi tiêu khớp đơn COMPLETED | `customers.total_spending` vs `SUM(orders.total_amount) WHERE status='COMPLETED'` | **khớp** |
| Giá snapshot bất biến | Đổi giá variant từ 2.200.000 → 9.500.000, đọc lại đơn cũ | **đơn vẫn 2.200.000**, tổng vẫn 6.130.000 |

Nhánh ngược (hủy đơn) cũng được kiểm chứng:

```text
tồn 20 → đặt 5 → tồn 15 (SALE -5) → hủy đơn → tồn 20 (RETURN +5)
```
Sau nhánh hủy: **0 variant lệch**.

## 5. Test đáng chú ý ngoài danh sách bắt buộc

| Nhóm | Case |
|---|---|
| Race condition kho | 2 lệnh xuất đồng thời trên tồn kho 1 → đúng một 201, một 422 |
| Race condition checkout | 2 khách cùng đặt variant còn 1 → đúng một đơn được tạo |
| Rollback phiếu kho | Phiếu nhập/xuất nhiều dòng, một dòng fail → cả phiếu rollback |
| Rollback checkout | Giỏ nhiều dòng, một dòng thiếu hàng → không đơn nào được tạo, dòng hợp lệ không bị trừ kho |
| Refresh token rotation | Dùng lại token đã rotate → 401 và thu hồi toàn bộ session của user |
| Khóa user | Access token còn hạn cũng mất hiệu lực ngay (403) |
| Quyền sở hữu đơn | Khách xem/hủy đơn của người khác → 403 |
| Khuyến mãi | Dùng lại mã đã dùng → 422; hủy đơn → nhả lại lượt dùng |
| Thanh toán | Hủy đơn chưa thu tiền giữ `UNPAID` (không ghi `REFUNDED` sai sổ) |
| Upload file | SVG có `<script>` bị từ chối 400 |

## 6. Bug được test phát hiện

| Wave | Bug | Hệ quả nếu không phát hiện |
|---|---|---|
| W2 | `register` và `users.create` select user **trước** khi gán role → trả `roles: []` | Access token phát ra không có quyền nào, khách vừa đăng ký không vào được đâu cả |
| W3 | `ProductDTO` lộ `deleted_at` | Rò rỉ cờ nội bộ của soft delete ra API công khai |
| W4 | `createBulkMovement` đọc "N giao dịch mới nhất của toàn bảng" sau commit | Request đồng thời trả về giao dịch của người khác |
| W5 | Mã đơn tạm `TMP-{uuid}` dài 40 ký tự > `VarChar(32)` | Mọi lần checkout trả 500 |
| W6 | — (không có bug code; 2 lỗi nằm ở chính test: payload `name` quá ngắn và sai số học `bandCenter`) | |

## 7. Báo cáo & Dashboard (W6)

Số liệu dashboard được đối chiếu với dữ liệu thật tạo qua API (3 đơn COMPLETED,
1 PENDING, 1 CANCELLED):

| Chỉ số | Kỳ vọng | Dashboard trả về | |
|---|---|---|---|
| Doanh thu (chỉ COMPLETED) | 9.990.000 | 9.990.000 | ✅ |
| Đơn hoàn thành | 3 | 3 | ✅ |
| Đơn tạo trong kỳ | 5 | 5 | ✅ |
| Đơn chờ xác nhận | 1 | 1 | ✅ |
| `range=today` | 9.990.000 | 9.990.000 | ✅ |
| Tổng tỷ trọng theo brand | 100% | 100,0% | ✅ |
| Đơn theo trạng thái | đủ 7 trạng thái kể cả count 0 | 7 | ✅ |

**Hai cơ sở tính doanh thu khác nhau — có chủ ý, không phải sai số:**

- `/reports/dashboard` → `revenue` cộng `orders.total_amount`: tiền thực thu,
  đã trừ giảm giá, **đã gồm** phí vận chuyển. `revenue_basis = order_total_including_shipping`.
- `/reports/revenue-by-brand` → cộng `order_details.line_total`: tiền **hàng**,
  không gồm phí ship và giảm giá toàn đơn (hai khoản này không thuộc thương hiệu nào).
  `basis = product_revenue_excluding_shipping_and_discount`.

Trong lần kiểm chứng: 9.990.000 − 9.900.000 = 90.000 = 3 đơn × 30.000 phí ship.
Chênh lệch này được ghi rõ trong response và hiển thị ngay dưới biểu đồ.

**Múi giờ:** báo cáo tính theo ngày giờ Việt Nam (UTC+7), không theo UTC. Nếu tính
theo UTC thì "doanh thu hôm nay" lệch 7 tiếng mỗi ngày — đơn đặt 8h sáng VN bị tính
sang hôm trước. 12 test trong `tests/unit/dateRange.test.js` kiểm chứng điều này,
gồm case "đơn 8h sáng VN nằm trong today" và "đơn 23h đêm hôm trước thì không".

**Biểu đồ:** 5 biểu đồ tự vẽ bằng SVG thuần thay vì dùng thư viện chart. Toán học
thang đo tách ra `scale.js` và có 24 test — đây là chỗ biểu đồ tự vẽ thường sai
(mốc trục không tròn, chia cho 0 khi max = 0, cột lấp kín band, crosshair lệch khi
chuột ra ngoài vùng vẽ). Màu chuỗi dữ liệu đã chạy qua validator màu: đạt cả 5 kiểm
tra trên đúng surface `#ffffff` của app.

## 8. Chưa kiểm thử (ghi nhận để làm tiếp)

- UI test end-to-end bằng trình duyệt (Playwright/Cypress) — hiện chỉ test component bằng RTL.
- Review (W7).
- Tải đồng thời ở quy mô lớn (hiện chỉ test 2 request song song).
