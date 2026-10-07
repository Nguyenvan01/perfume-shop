import { describe, expect, it } from 'vitest';
import { STATUS_TRANSITIONS, isValidTransition, canCustomerCancel } from './orderFlow';

describe('Bảng chuyển trạng thái đơn hàng', () => {
  it('đi đúng vòng đời thuận', () => {
    expect(isValidTransition('PENDING', 'CONFIRMED')).toBe(true);
    expect(isValidTransition('CONFIRMED', 'PACKING')).toBe(true);
    expect(isValidTransition('PACKING', 'SHIPPING')).toBe(true);
    expect(isValidTransition('SHIPPING', 'COMPLETED')).toBe(true);
  });

  it('TC08 — nhảy bước bị chặn', () => {
    expect(isValidTransition('PENDING', 'SHIPPING')).toBe(false);
    expect(isValidTransition('PENDING', 'COMPLETED')).toBe(false);
    expect(isValidTransition('CONFIRMED', 'SHIPPING')).toBe(false);
  });

  it('không đi lùi được', () => {
    expect(isValidTransition('SHIPPING', 'PACKING')).toBe(false);
    expect(isValidTransition('COMPLETED', 'SHIPPING')).toBe(false);
  });

  it('chỉ hủy được khi chưa đóng gói', () => {
    expect(isValidTransition('PENDING', 'CANCELLED')).toBe(true);
    expect(isValidTransition('CONFIRMED', 'CANCELLED')).toBe(true);
    expect(isValidTransition('PACKING', 'CANCELLED')).toBe(false);
    expect(isValidTransition('SHIPPING', 'CANCELLED')).toBe(false);
  });

  it('chỉ trả hàng được từ đơn hoàn thành', () => {
    expect(isValidTransition('COMPLETED', 'RETURNED')).toBe(true);
    expect(isValidTransition('SHIPPING', 'RETURNED')).toBe(false);
  });

  it('CANCELLED và RETURNED là trạng thái cuối', () => {
    expect(STATUS_TRANSITIONS.CANCELLED).toEqual([]);
    expect(STATUS_TRANSITIONS.RETURNED).toEqual([]);
  });

  it('trạng thái lạ không làm hàm nổ', () => {
    expect(isValidTransition('KHONG_TON_TAI', 'CONFIRMED')).toBe(false);
  });
});

describe('canCustomerCancel', () => {
  it('khách chỉ hủy được đơn PENDING', () => {
    expect(canCustomerCancel('PENDING')).toBe(true);
    expect(canCustomerCancel('CONFIRMED')).toBe(false);
    expect(canCustomerCancel('SHIPPING')).toBe(false);
  });
});
