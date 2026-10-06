export const ROLES = {
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
  CUSTOMER: 'CUSTOMER',
};

/** Nhãn tiếng Việt cho enum backend (OD-10). */
export const ORDER_STATUS_LABEL = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PACKING: 'Đang đóng gói',
  SHIPPING: 'Đang giao',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  RETURNED: 'Đã trả hàng',
};

export const ORDER_STATUS_COLOR = {
  PENDING: 'default',
  CONFIRMED: 'blue',
  PACKING: 'cyan',
  SHIPPING: 'gold',
  COMPLETED: 'green',
  CANCELLED: 'red',
  RETURNED: 'volcano',
};

export const GENDER_LABEL = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  UNISEX: 'Unisex',
};

export const CONCENTRATION_LABEL = {
  EDC: 'EDC',
  EDT: 'EDT',
  EDP: 'EDP',
  PARFUM: 'Parfum',
};

export const INVENTORY_TYPE_LABEL = {
  IMPORT: 'Nhập kho',
  EXPORT: 'Xuất kho',
  SALE: 'Bán hàng',
  RETURN: 'Trả hàng',
  ADJUSTMENT: 'Điều chỉnh',
};

export const STATUS_LABEL = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
};

export const USER_STATUS_LABEL = {
  ACTIVE: 'Hoạt động',
  LOCKED: 'Đã khóa',
};

export const PAYMENT_METHOD_LABEL = {
  COD: 'Thanh toán khi nhận hàng',
  BANK_TRANSFER: 'Chuyển khoản',
};

export const PAYMENT_STATUS_LABEL = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  REFUNDED: 'Đã hoàn tiền',
};

export const DISCOUNT_TYPE_LABEL = {
  PERCENTAGE: 'Giảm theo %',
  FIXED: 'Giảm số tiền',
};
