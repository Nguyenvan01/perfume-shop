'use strict';

const {
  ORDER_STATUS,
  STATUS_TRANSITIONS,
  CUSTOMER_CANCELLABLE,
  STAFF_CANCELLABLE,
  isValidTransition,
} = require('../../src/modules/orders/order.constant');

const ALL = Object.values(ORDER_STATUS);

describe('Bảng chuyển trạng thái đơn hàng — phủ hết mọi cặp', () => {
  /** Tập hợp các cặp (from, to) hợp lệ theo CLAUDE.md §7. */
  const VALID_PAIRS = new Set([
    'PENDING>CONFIRMED',
    'PENDING>CANCELLED',
    'CONFIRMED>PACKING',
    'CONFIRMED>CANCELLED',
    'PACKING>SHIPPING',
    'SHIPPING>COMPLETED',
    'COMPLETED>RETURNED',
  ]);

  it('kiểm tra TOÀN BỘ 49 cặp trạng thái: đúng 7 cặp hợp lệ, 42 cặp bị chặn', () => {
    const allowed = [];
    const blocked = [];

    for (const from of ALL) {
      for (const to of ALL) {
        const key = `${from}>${to}`;
        const result = isValidTransition(from, to);
        (result ? allowed : blocked).push(key);
        // Mỗi cặp phải khớp đúng bảng, không thiếu không thừa.
        expect(result).toBe(VALID_PAIRS.has(key));
      }
    }

    expect(allowed).toHaveLength(7);
    expect(blocked).toHaveLength(ALL.length * ALL.length - 7);
  });

  it('không trạng thái nào tự chuyển về chính nó', () => {
    for (const status of ALL) {
      expect(isValidTransition(status, status)).toBe(false);
    }
  });

  it('không đi lùi được ở bất kỳ bước nào của luồng thuận', () => {
    const forward = ['PENDING', 'CONFIRMED', 'PACKING', 'SHIPPING', 'COMPLETED'];
    for (let i = 1; i < forward.length; i += 1) {
      for (let j = 0; j < i; j += 1) {
        expect(isValidTransition(forward[i], forward[j])).toBe(false);
      }
    }
  });

  it('CANCELLED và RETURNED là trạng thái cuối, không có đường ra', () => {
    expect(STATUS_TRANSITIONS.CANCELLED).toEqual([]);
    expect(STATUS_TRANSITIONS.RETURNED).toEqual([]);
    for (const to of ALL) {
      expect(isValidTransition('CANCELLED', to)).toBe(false);
      expect(isValidTransition('RETURNED', to)).toBe(false);
    }
  });

  it('mọi trạng thái đều có khai báo trong bảng (không sót khi thêm status mới)', () => {
    for (const status of ALL) {
      expect(STATUS_TRANSITIONS).toHaveProperty(status);
      expect(Array.isArray(STATUS_TRANSITIONS[status])).toBe(true);
    }
  });

  it('mọi đích đến trong bảng đều là trạng thái hợp lệ (không có typo)', () => {
    for (const targets of Object.values(STATUS_TRANSITIONS)) {
      for (const target of targets) {
        expect(ALL).toContain(target);
      }
    }
  });

  it('trạng thái không tồn tại → false, không throw', () => {
    expect(isValidTransition('KHONG_TON_TAI', 'CONFIRMED')).toBe(false);
    expect(isValidTransition('PENDING', 'KHONG_TON_TAI')).toBe(false);
    expect(isValidTransition(undefined, undefined)).toBe(false);
  });

  it('quyền hủy: khách hẹp hơn nhân viên và là tập con', () => {
    expect(CUSTOMER_CANCELLABLE).toEqual(['PENDING']);
    expect(STAFF_CANCELLABLE).toEqual(['PENDING', 'CONFIRMED']);
    for (const status of CUSTOMER_CANCELLABLE) {
      expect(STAFF_CANCELLABLE).toContain(status);
    }
  });

  it('mọi trạng thái cho phép hủy đều thực sự có đường tới CANCELLED', () => {
    for (const status of STAFF_CANCELLABLE) {
      expect(isValidTransition(status, 'CANCELLED')).toBe(true);
    }
  });
});
