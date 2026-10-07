'use strict';

const ORDER_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PACKING: 'PACKING',
  SHIPPING: 'SHIPPING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  RETURNED: 'RETURNED',
};

/**
 * Chuyển trạng thái hợp lệ (CLAUDE.md §7). Mọi chuyển đổi ngoài bảng này bị từ chối.
 * CANCELLED và RETURNED là trạng thái cuối, không đi tiếp được.
 */
const STATUS_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PACKING', 'CANCELLED'],
  PACKING: ['SHIPPING'],
  SHIPPING: ['COMPLETED'],
  COMPLETED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

/** Khách chỉ hủy được khi đơn chưa được xác nhận. */
const CUSTOMER_CANCELLABLE = ['PENDING'];
/** Admin/Staff hủy được khi đơn chưa đóng gói. */
const STAFF_CANCELLABLE = ['PENDING', 'CONFIRMED'];

/** Trạng thái làm kho giảm đã xảy ra lúc đặt hàng → khi hủy/trả phải cộng lại. */
const STOCK_RESTORING_STATUSES = ['CANCELLED', 'RETURNED'];

const isValidTransition = (from, to) => (STATUS_TRANSITIONS[from] ?? []).includes(to);

module.exports = {
  ORDER_STATUS,
  STATUS_TRANSITIONS,
  CUSTOMER_CANCELLABLE,
  STAFF_CANCELLABLE,
  STOCK_RESTORING_STATUSES,
  isValidTransition,
};
