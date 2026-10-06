import dayjs from 'dayjs';

/**
 * Backend trả tiền dạng string (Decimal) — xem implementation_plan.md §2.
 * Mọi chỗ hiển thị tiền phải đi qua hàm này.
 */
export function formatCurrency(value) {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value ?? 0));
}

export function formatDate(value) {
  return value ? dayjs(value).format('DD/MM/YYYY') : '—';
}

export function formatDateTime(value) {
  return value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—';
}

/** Tra nhãn tiếng Việt, fallback về chính giá trị enum nếu chưa có nhãn. */
export function formatLabel(map, value) {
  if (value === null || value === undefined) return '—';
  return map[value] ?? value;
}
