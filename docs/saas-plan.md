# Kế hoạch nâng cấp lên SaaS nhiều cửa hàng

Trạng thái: **bản nháp chờ duyệt**. Chưa code gì. Cập nhật: 2026-10-31.

Mục tiêu: biến hệ thống quản lý một shop online thành phần mềm cho thuê. Mỗi cửa hàng
là một tenant, có nhiều chi nhánh, bán tại quầy (POS) và online, quản lý kho đến từng ml.

Giữ lại toàn bộ stack và kiến trúc hiện tại (Route → Controller → Service → Repository,
Prisma, AntD, TanStack Query). Không đổi framework.

---

## 0. Cần bạn chốt trước khi code

Mỗi dòng đã có đề xuất. Bạn chỉ cần trả lời "đồng ý hết" hoặc nêu dòng muốn đổi.

| # | Câu hỏi | Đề xuất | Lý do |
|---|---|---|---|
| D1 | Tính giá vốn thế nào? | **Bình quân gia quyền** theo chi nhánh | Đơn giản, giống KiotViet/Sapo. FIFO theo lô chính xác hơn nhưng mọi lần bán phải chọn lô, phức tạp gấp nhiều lần |
| D2 | Brand, danh mục dùng chung hay riêng từng shop? | **Riêng từng shop** | Tách dữ liệu sạch, không cần người duyệt dữ liệu chung |
| D3 | Website bán online của từng shop ở đâu? | **Đường dẫn** `/s/<slug-shop>` | Không cần cấu hình domain. Subdomain làm sau |
| D4 | Cổng thanh toán thuê bao | **PayOS trước**, SePay sau | PayOS có SDK và webhook ký sẵn |
| D5 | Mời nhân viên, quên mật khẩu | **Thêm gửi email** (Resend hoặc SMTP) | Hiện quên mật khẩu trên production **không hoạt động** vì không gửi email (`auth.service.js:171`). SaaS bắt buộc phải có |
| D6 | Dữ liệu hiện tại | **Được reset DB dev**, viết lại migration | Chưa có production nên không có dữ liệu thật cần giữ |
| D7 | Cách tách dữ liệu giữa các shop | **Lọc `shop_id` ở tầng repository** + test chéo tenant | Chặn ở DB bằng Row Level Security của Postgres làm sau, khi có khách thật |
| D8 | Bán chiết | **Chỉ bán ống chiết có SKU** (5ml, 10ml…) | Không bán "theo ml tự nhập" ở quầy, tránh sai số |
| D9 | Kiểm kê có khóa bán hàng không? | **Không khóa** | Chênh lệch = số đếm − tồn lúc bắt đầu kiểm, cộng vào tồn hiện tại khi chốt |
| D10 | Sửa `CLAUDE.md` | **Có**: thay vai trò, quy tắc kho, milestone, bỏ cấm payment online cho thuê bao | File này là nguồn sự thật cho mọi agent làm sau |

---

## 1. Kiến trúc tenant

```text
Platform (chủ phần mềm, is_platform_admin)
└── Shop (tenant) ── Subscription ── Plan
    ├── ShopMember (user + vai trò + chi nhánh được làm)
    ├── Branch ──< BranchStock >── ProductVariant
    ├── Brand, Category, Product, Supplier, Customer, Promotion
    └── Order (POS hoặc online), PurchaseReceipt, StockTransfer, Stocktake
```

- **Một user có thể thuộc nhiều shop** (vd nhân viên làm 2 nơi). Bảng `shop_members`.
- **Access token chứa `shop_id` + vai trò trong shop đó.** Đổi shop gọi
  `POST /auth/switch-shop` để lấy token mới. Không nhận `shop_id` từ body hay header,
  để client không tự chọn shop khác.
- **Mọi repository nhận `shopId` làm tham số bắt buộc** và luôn có `where: { shop_id }`.
  Truy cập bản ghi của shop khác trả **404**, không phải 403, để không lộ là bản ghi có tồn tại.
- Unique trước đây là toàn cục thì nay theo shop: `@@unique([shop_id, slug])`,
  `@@unique([shop_id, sku])`, `@@unique([shop_id, barcode])`, `@@unique([shop_id, code])`…
- Khách mua online có tài khoản `users` chung, nhưng hồ sơ khách là của từng shop
  (`customers.shop_id`). Khách vãng lai ở quầy chỉ cần tên và số điện thoại, không cần tài khoản.

### Vai trò trong shop

| Quyền | OWNER | MANAGER | CASHIER | WAREHOUSE |
|---|:-:|:-:|:-:|:-:|
| Cài đặt shop, gói thuê bao, thanh toán | ✅ | | | |
| Mời / khóa nhân viên, phân quyền | ✅ | ✅ (trừ OWNER) | | |
| Chi nhánh | ✅ | ✅ | | |
| Sản phẩm, giá, nhập Excel | ✅ | ✅ | xem | xem |
| Nhập hàng, chuyển kho, kiểm kê, hao hụt, chiết | ✅ | ✅ | | ✅ |
| POS, đơn online, đổi trả | ✅ | ✅ | ✅ | |
| Khách hàng, tích điểm | ✅ | ✅ | ✅ | |
| Công nợ | ✅ | ✅ | xem | |
| Báo cáo doanh thu | ✅ | ✅ | ca của mình | |
| Báo cáo lợi nhuận, giá trị tồn kho | ✅ | ✅ | | |

- CASHIER và WAREHOUSE chỉ thao tác ở **chi nhánh được gán** (`member_branches`).
- Vẫn dùng bảng `permissions` hiện có. Vai trò là role hệ thống, mỗi role có sẵn một bộ quyền.
  Role tùy chỉnh theo shop làm sau.
- Khách mua online (CUSTOMER) giữ nguyên quyền như hiện tại, chỉ trong phạm vi shop đó.

---

## 2. Thay đổi schema

Ký hiệu: 🆕 bảng mới · ✏️ bảng sửa · ❌ bỏ.

### 2.1 SaaS

```prisma
model Shop {            // 🆕 tenant
  id, name, slug @unique, logo_url, address, phone, tax_code,
  invoice_footer,       // dòng chữ in cuối hóa đơn
  loyalty_earn_rate,    // vd 10000 = 1 điểm / 10.000đ
  loyalty_point_value,  // giá trị 1 điểm khi đổi
  status, created_at, updated_at
}
model ShopMember {      // 🆕 user thuộc shop với 1 vai trò
  shop_id, user_id, role (OWNER|MANAGER|CASHIER|WAREHOUSE), status (ACTIVE|LOCKED)
  @@unique([shop_id, user_id])
}
model MemberBranch { member_id, branch_id }        // 🆕
model Invitation {      // 🆕 link mời, hết hạn sau 7 ngày
  shop_id, email, role, token_hash, expires_at, accepted_at, invited_by
}
model Plan {            // 🆕 Free / Cơ bản / Chuyên nghiệp
  code @unique, name, price_monthly Decimal, max_branches Int?, max_members Int?, features Json
}
model Subscription {    // 🆕
  shop_id @unique, plan_id, status (TRIALING|ACTIVE|PAST_DUE|CANCELLED),
  current_period_end
}
model SubscriptionPayment {  // 🆕 mỗi lần thanh toán qua PayOS
  shop_id, plan_id, amount, provider, provider_order_code @unique, status, paid_at, raw Json
}
```

- `User` ✏️: thêm `is_platform_admin`. Bỏ `user_roles`.
- `Role`, `UserRole` ❌: thay bằng `ShopMember.role`. `Permission`, `RolePermission` giữ,
  `role_permissions` đổi sang map theo tên role.

### 2.2 Sản phẩm

```prisma
model Product {         // ✏️
  + shop_id
  + top_notes, heart_notes, base_notes   String[]   // tầng hương
  - concentration                                   // chuyển xuống variant
  @@unique([shop_id, slug])
}
model ProductVariant {  // ✏️
  + shop_id
  + concentration       (EDC|EDT|EDP|PARFUM|EXTRAIT)
  + condition           (FULLBOX|TESTER|UNBOX|DECANT)
  + barcode String?     @@unique([shop_id, barcode])
  - stock_quantity      // chuyển sang BranchStock
  @@unique([shop_id, sku])
  @@unique([product_id, volume_ml, concentration, condition])
}
```

`Brand`, `Category` ✏️: thêm `shop_id`, slug unique theo shop.

### 2.3 Kho — phần quan trọng nhất

```prisma
model Branch {          // 🆕
  shop_id, name, address, phone, is_default, status
}
model BranchStock {     // 🆕 NGUỒN SỰ THẬT DUY NHẤT của tồn kho
  branch_id, variant_id,
  quantity Int,         // không bao giờ < 0 (CHECK constraint)
  avg_cost Decimal      // giá vốn bình quân (D1)
  @@id([branch_id, variant_id])
}
model Supplier {        // 🆕
  shop_id, name, phone, address, note, status
}
model PurchaseReceipt { // 🆕 phiếu nhập
  shop_id, branch_id, supplier_id, code, status (DRAFT|COMPLETED|CANCELLED),
  total_amount, paid_amount, note, created_by, completed_at
}
model PurchaseReceiptItem { // 🆕 1 dòng = 1 lô
  receipt_id, variant_id, quantity, unit_cost,
  batch_code, manufactured_at, expires_at?, source (AUTHENTIC|HAND_CARRIED)
}
model StockTransfer {   // 🆕 chuyển kho
  shop_id, from_branch_id, to_branch_id, code,
  status (DRAFT|IN_TRANSIT|RECEIVED|CANCELLED), sent_at, received_at, created_by
}
model StockTransferItem { transfer_id, variant_id, quantity }   // 🆕
model Stocktake {       // 🆕 kiểm kê
  shop_id, branch_id, code, status (COUNTING|COMPLETED|CANCELLED), started_at, completed_at
}
model StocktakeItem {   // 🆕
  stocktake_id, variant_id, system_qty (chụp lúc bắt đầu), counted_qty?
}
model OpenBottle {      // 🆕 chai đã mở để chiết
  shop_id, branch_id, source_variant_id, initial_ml, remaining_ml (>= 0),
  cost_per_ml Decimal, status (OPEN|EMPTY), opened_at, opened_by
}
model DecantLog {       // 🆕 mỗi lần chiết hoặc hao hụt ml
  bottle_id, decant_variant_id?, decant_quantity?, ml_used, loss_ml, reason?, created_by
}
model InventoryTransaction {  // ✏️
  + shop_id, branch_id, unit_cost
  + shrinkage_reason (BROKEN|EVAPORATION|TESTER_USE|EXPIRED|OTHER)?
  type: IMPORT | SALE | RETURN | ADJUSTMENT | STOCKTAKE | SHRINKAGE
      | TRANSFER_OUT | TRANSFER_IN | OPEN_FOR_DECANT | DECANT_IN | RETURN_TO_SUPPLIER
}
```

**Luồng chiết** (1 DB transaction):

1. **Mở chai:** `BranchStock` của chai nguồn −1, ghi `OPEN_FOR_DECANT`. Tạo `OpenBottle`
   với `remaining_ml = volume_ml` và `cost_per_ml = avg_cost / volume_ml`.
2. **Chiết** n ống x ml: `remaining_ml -= n × x + loss_ml`, từ chối nếu kết quả < 0.
   `BranchStock` của ống chiết +n, ghi `DECANT_IN` với giá vốn `= x × cost_per_ml`
   (cộng chi phí ống nếu có). Ghi `DecantLog`.
3. **Bay hơi / đổ vỡ chai mở:** chỉ trừ `remaining_ml` và ghi `DecantLog` có lý do.
   `remaining_ml = 0` thì chai chuyển `EMPTY`.

**Quy tắc kho (thay mục 7 của CLAUDE.md):**

- Tồn kho chỉ nằm ở `branch_stocks`. Ml còn lại của chai mở chỉ nằm ở `open_bottles`.
- Mọi thay đổi ghi `inventory_transactions` hoặc `decant_logs` trong cùng DB transaction.
- Lock hàng `branch_stocks` (`SELECT … FOR UPDATE`) theo thứ tự `(branch_id, variant_id)`
  tăng dần, giữ cách tránh deadlock đang có ở module order.
- Nhập hàng: `avg_cost mới = (qty × avg_cost + qty_nhập × giá_nhập) / (qty + qty_nhập)`.
- Chuyển kho: trừ kho đi khi `IN_TRANSIT`, cộng kho đến khi `RECEIVED` với giá vốn của kho đi.
  Hủy khi đang chuyển thì trả lại kho đi.

### 2.4 Bán hàng

```prisma
model Order {           // ✏️ dùng chung cho POS và online
  + shop_id, branch_id, channel (POS|ONLINE), cashier_id?
  ~ customer_id         // cho phép null: khách vãng lai ở quầy
  ~ receiver_*, shipping_address   // cho phép null với POS
  + points_used, points_discount, points_earned
  + paid_amount, debt_amount
}
model OrderDetail {     // ✏️
  + unit_cost           // snapshot giá vốn lúc bán → tính lợi nhuận
  + condition, concentration      // snapshot
}
model Payment {         // ✏️ 1 đơn nhiều lần trả (tiền mặt + chuyển khoản)
  - order_id @unique
  method: CASH | BANK_TRANSFER | CARD | COD | POINTS
}
model SalesReturn {     // 🆕 đổi trả một phần
  shop_id, order_id, branch_id, code, refund_amount, refund_method, reason, created_by
}
model SalesReturnItem { return_id, order_detail_id, quantity, restock Boolean }  // 🆕
model DebtEntry {       // 🆕 sổ công nợ (dương = họ nợ shop)
  shop_id, party_type (CUSTOMER|SUPPLIER), customer_id?, supplier_id?,
  amount Decimal, reference, note, created_by, created_at
}
```

- **Đơn POS** tạo thẳng ở trạng thái `COMPLETED`: trừ kho chi nhánh, ghi `SALE`, cộng điểm.
- **Đơn online** giữ nguyên bảng chuyển trạng thái hiện tại, thêm bước chọn chi nhánh xuất hàng
  (mặc định chi nhánh `is_default`).
- **Đổi trả:** trả một phần đơn. `restock = true` cộng lại kho (`RETURN`). Hàng hỏng không
  cộng lại mà ghi `SHRINKAGE`. Trừ lại điểm đã cộng tương ứng.
  Đổi hàng = trả hàng + tạo đơn mới.
- **Công nợ** khách sỉ: phần chưa trả của đơn ghi `DebtEntry` dương, khách trả nợ ghi âm.
  Phiếu nhập chưa trả hết cho nhà cung cấp cũng ghi tương tự.
  Số dư = tổng `amount`, có index `(shop_id, party_type, customer_id/supplier_id)`.

### 2.5 Khách hàng

```prisma
model Customer {        // ✏️
  + shop_id, full_name, phone, email?, birthday?, note
  ~ user_id?            // null với khách tại quầy
  + points Int, tier_id?, is_wholesale Boolean
  + preferred_families String[]   // ghi tay; ngoài ra còn tính từ lịch sử mua
  @@unique([shop_id, phone])
}
model LoyaltyTier { shop_id, name, min_spending Decimal, discount_percent }  // 🆕
model PointLedger { shop_id, customer_id, change Int, balance_after, reason, order_id? }  // 🆕
```

**Gợi ý mùi tương tự:** không dùng AI. Lấy các nhóm hương khách mua nhiều nhất và các
nốt hương trùng, chọn sản phẩm cùng nhóm, còn hàng ở chi nhánh hiện tại, chưa từng mua.
Sắp theo số nốt hương trùng.

---

## 3. Milestone

Làm tuần tự. Mỗi milestone có PR riêng, test pass, lint, build sạch mới sang milestone sau.
Cỡ: S nhỏ · M vừa · L lớn.

| # | Milestone | Cỡ | Phạm vi | Xong khi |
|---|---|---|---|---|
| S0 | Chuẩn bị | S | Bạn chốt mục 0, sửa `CLAUDE.md`, thêm module gửi email (D5), deploy bản hiện tại | `CLAUDE.md` mới được duyệt, quên mật khẩu gửi được email |
| S1 | Tenant + chi nhánh | **L** | `shops`, `shop_members`, `branches`, `branch_stocks`; thêm `shop_id` vào mọi bảng; token theo shop; switch-shop; sửa **mọi** repository nhận `shopId`; đăng ký = tạo shop + chi nhánh mặc định + OWNER; seed 2 shop | Toàn bộ test cũ pass sau khi sửa; **test chéo tenant** cho mọi module: user shop A đọc/sửa/xóa dữ liệu shop B → 404 |
| S2 | Nhân viên + vai trò | M | 4 vai trò mới, gán chi nhánh, mời qua email, khóa/mở; cài đặt shop (tên, logo, địa chỉ, chân hóa đơn) | Ma trận quyền mục 1 có test cho từng ô |
| S3 | Sản phẩm nâng cao | M | Nồng độ và tình trạng ở variant, mã vạch, tầng hương; nhập Excel (xem trước + báo lỗi từng dòng, chỉ ghi khi không lỗi dòng nào) | Import file 500 dòng: dòng lỗi được báo đúng số dòng, không ghi nửa chừng |
| S4 | Kho nhiều chi nhánh | **L** | Nhà cung cấp, phiếu nhập theo lô + giá vốn bình quân, chuyển kho, kiểm kê, hao hụt, cảnh báo sắp hết theo chi nhánh | Không tồn âm; mọi thay đổi có transaction; test đồng thời: 2 người chuyển kho/bán cùng lúc không lệch số |
| S5 | Chiết | M | Mở chai, chiết, hao hụt ml, lịch sử từng chai | Tổng ml (chai mở + ống chiết + hao hụt) khớp ml chai gốc |
| S6 | POS | **L** | Màn hình POS: quét mã vạch (máy quét USB gõ như bàn phím), tìm theo tên, giỏ tại quầy, mã giảm giá, dùng điểm, trả nhiều hình thức, ghi nợ; in hóa đơn 80mm + tem mã vạch (in từ trình duyệt); đổi trả; công nợ | Bán 1 đơn tiền mặt + chuyển khoản, in được; đổi trả cộng kho và trừ điểm đúng |
| S7 | Khách hàng thân thiết | M | Hồ sơ khách theo shop, tích điểm, hạng thành viên, mùi ưa thích, gợi ý mùi tương tự | Điểm và hạng tính lại đúng sau bán, trả, hủy |
| S8 | Báo cáo | M | Doanh thu, lợi nhuận theo ngày/chi nhánh/nhân viên; bán chạy; tồn lâu (không bán trong N ngày); chiết vs nguyên chai; giá trị tồn kho | Mọi số liệu có test đối chiếu với dữ liệu seed tính tay |
| S9 | Thuê bao | M | Gói, giới hạn chi nhánh/nhân viên, dùng thử 14 ngày, thanh toán PayOS + webhook (kiểm chữ ký, xử lý trùng); trang quản trị platform | Vượt giới hạn gói bị chặn ở backend; webhook gửi trùng 2 lần chỉ gia hạn 1 lần |

**Vì sao thứ tự này:** S1 đụng vào mọi bảng và mọi query, làm sau thì phải sửa lại mọi thứ.
S4 cần chi nhánh (S1). S5 cần giá vốn (S4). S6 cần kho và chiết. S8 cần giá vốn trong đơn (S6).
S9 để cuối vì chưa có khách trả tiền thì chưa cần.

### Thư viện mới cần thêm

| Thư viện | Chỗ dùng | Lý do |
|---|---|---|
| `exceljs` | backend | Đọc file Excel nhập hàng loạt (S3) |
| `jsbarcode` | frontend | Vẽ mã vạch để in tem (S6) |
| `resend` hoặc `nodemailer` | backend | Gửi email mời, quên mật khẩu (S0) |
| `@payos/node` | backend | Thanh toán thuê bao (S9) |

Quét mã vạch không cần thư viện: máy quét USB gõ mã như bàn phím rồi Enter.
In hóa đơn dùng `window.print()` với CSS khổ 80mm.

---

## 4. Rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Lộ dữ liệu giữa các shop (lỗi nặng nhất của SaaS) | `shopId` bắt buộc ở mọi hàm repository; test chéo tenant tự động cho mọi endpoint; sau S1 xem xét bật Row Level Security |
| S1 làm vỡ toàn bộ 543 + 111 test hiện có | Sửa test cùng PR. Không merge khi còn test đỏ |
| Lệch tồn kho khi nhiều quầy bán cùng lúc | Giữ lock hàng + một thứ tự lock + retry deadlock đang có, mở rộng sang `branch_stocks` |
| Giá vốn sai làm sai lợi nhuận | Snapshot `unit_cost` vào từng dòng đơn và từng transaction; báo cáo chỉ đọc snapshot |
| Webhook thanh toán giả hoặc gửi trùng | Kiểm chữ ký PayOS, `provider_order_code` unique |
| Phạm vi quá lớn | Mỗi milestone là 1 PR chạy được; có thể dừng sau S6 và đã có sản phẩm dùng được cho 1 chuỗi cửa hàng |

---

## 5. Chưa làm trong kế hoạch này

Mỗi mục làm được sau mà không phải đổi schema lớn:

- App mobile, POS chạy offline.
- Subdomain hoặc domain riêng cho từng shop.
- Hóa đơn điện tử theo quy định thuế.
- Đồng bộ sàn TMĐT (Shopee, TikTok Shop).
- Role tùy chỉnh theo shop.
- FIFO theo lô (nếu sau này cần, đổi cách tính giá vốn ở S4).
