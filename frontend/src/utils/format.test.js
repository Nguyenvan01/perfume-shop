import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate, formatLabel, formatNumber } from './format';
import { ORDER_STATUS_LABEL } from './constants';

describe('formatCurrency', () => {
  it('format string Decimal từ backend thành tiền VND', () => {
    // Backend trả Decimal dạng string (implementation_plan.md §2).
    expect(formatCurrency('1850000.00').replace(/\s/g, ' ')).toContain('1.850.000');
  });

  it('trả 0 ₫ khi giá trị rỗng hoặc sai', () => {
    expect(formatCurrency(null)).toContain('0');
    expect(formatCurrency('abc')).toBe('0 ₫');
  });
});

describe('formatNumber', () => {
  it('dùng dấu phân cách tiếng Việt', () => {
    expect(formatNumber(1234567)).toBe('1.234.567');
  });
});

describe('formatDate', () => {
  it('format dd/MM/yyyy', () => {
    expect(formatDate('2026-10-06T10:00:00.000Z')).toMatch(/^\d{2}\/\d{2}\/2026$/);
  });

  it('trả dấu gạch khi không có giá trị', () => {
    expect(formatDate(null)).toBe('—');
  });
});

describe('formatLabel', () => {
  it('tra nhãn tiếng Việt cho enum', () => {
    expect(formatLabel(ORDER_STATUS_LABEL, 'PENDING')).toBe('Chờ xác nhận');
  });

  it('fallback về chính enum khi chưa có nhãn', () => {
    expect(formatLabel(ORDER_STATUS_LABEL, 'UNKNOWN_STATUS')).toBe('UNKNOWN_STATUS');
  });
});
