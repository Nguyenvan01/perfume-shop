/**
 * Bản sao bảng chuyển trạng thái của backend, dùng cho test và hiển thị.
 * Nguồn sự thật vẫn là backend: API trả `allowed_transitions` cho mỗi đơn,
 * UI chỉ hiện nút theo danh sách đó.
 */
export const STATUS_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PACKING', 'CANCELLED'],
  PACKING: ['SHIPPING'],
  SHIPPING: ['COMPLETED'],
  COMPLETED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

export const isValidTransition = (from, to) => (STATUS_TRANSITIONS[from] ?? []).includes(to);

/** Khách chỉ hủy được đơn chưa xác nhận. */
export const canCustomerCancel = (status) => status === 'PENDING';
