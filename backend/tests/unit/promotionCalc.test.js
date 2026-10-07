'use strict';

const { calculateDiscount, assertUsable, effectiveState } = require('../../src/modules/promotions/promotion.service');

const base = (overrides = {}) => ({
  id: 1,
  code: 'TEST',
  status: 'ACTIVE',
  discount_type: 'PERCENTAGE',
  discount_value: 10,
  minimum_order_value: 0,
  max_discount: null,
  usage_limit: null,
  per_customer_limit: 1,
  used_count: 0,
  start_date: new Date('2026-01-01'),
  end_date: new Date('2027-01-01'),
  ...overrides,
});

describe('calculateDiscount', () => {
  it('PERCENTAGE tính đúng phần trăm', () => {
    expect(Number(calculateDiscount(base({ discount_value: 10 }), 1_000_000))).toBe(100_000);
    expect(Number(calculateDiscount(base({ discount_value: 25 }), 2_000_000))).toBe(500_000);
  });

  it('PERCENTAGE bị chặn bởi max_discount', () => {
    const promotion = base({ discount_value: 10, max_discount: 300_000 });
    // 10% của 5tr = 500k nhưng trần là 300k.
    expect(Number(calculateDiscount(promotion, 5_000_000))).toBe(300_000);
    // Dưới trần thì không bị chặn.
    expect(Number(calculateDiscount(promotion, 2_000_000))).toBe(200_000);
  });

  it('FIXED trả đúng số tiền, không quan tâm subtotal', () => {
    const promotion = base({ discount_type: 'FIXED', discount_value: 200_000 });
    expect(Number(calculateDiscount(promotion, 5_000_000))).toBe(200_000);
  });

  it('giảm giá không bao giờ vượt subtotal — tổng đơn không âm', () => {
    const promotion = base({ discount_type: 'FIXED', discount_value: 500_000 });
    expect(Number(calculateDiscount(promotion, 300_000))).toBe(300_000);
  });

  it('subtotal 0 → giảm 0', () => {
    expect(Number(calculateDiscount(base(), 0))).toBe(0);
  });

  it('tính bằng Decimal nên không sai số dấu phẩy động', () => {
    // 3 × 0.1 bằng float cho 0.30000000000000004
    const promotion = base({ discount_type: 'FIXED', discount_value: 0.1 });
    const total = [1, 2, 3].reduce(
      (sum, _) => sum + Number(calculateDiscount(promotion, 1000)),
      0
    );
    expect(total).toBeCloseTo(0.3, 10);
  });
});

describe('assertUsable — mỗi rule một message riêng', () => {
  const opts = { subtotal: 1_000_000, customerUsageCount: 0 };

  it('mã hợp lệ → không throw', () => {
    expect(() => assertUsable(base(), opts)).not.toThrow();
  });

  it('status INACTIVE → not active', () => {
    expect(() => assertUsable(base({ status: 'INACTIVE' }), opts)).toThrow(/not active/);
  });

  it('chưa tới ngày bắt đầu → has not started', () => {
    expect(() =>
      assertUsable(base({ start_date: new Date('2099-01-01') }), opts)
    ).toThrow(/has not started/);
  });

  it('quá ngày kết thúc → has expired', () => {
    expect(() => assertUsable(base({ end_date: new Date('2020-01-01') }), opts)).toThrow(
      /has expired/
    );
  });

  it('hết lượt tổng → usage limit reached', () => {
    expect(() => assertUsable(base({ usage_limit: 5, used_count: 5 }), opts)).toThrow(
      /Usage limit reached/
    );
  });

  it('usage_limit null = không giới hạn', () => {
    expect(() =>
      assertUsable(base({ usage_limit: null, used_count: 9999 }), opts)
    ).not.toThrow();
  });

  it('chưa đạt giá trị tối thiểu → minimum value', () => {
    expect(() =>
      assertUsable(base({ minimum_order_value: 3_000_000 }), opts)
    ).toThrow(/minimum value/);
  });

  it('đúng bằng giá trị tối thiểu → hợp lệ (biên)', () => {
    expect(() =>
      assertUsable(base({ minimum_order_value: 1_000_000 }), opts)
    ).not.toThrow();
  });

  it('khách đã dùng hết lượt của mình → already used', () => {
    expect(() =>
      assertUsable(base({ per_customer_limit: 1 }), { ...opts, customerUsageCount: 1 })
    ).toThrow(/already used/);
  });

  it('per_customer_limit 2 thì khách dùng lần 2 vẫn được', () => {
    expect(() =>
      assertUsable(base({ per_customer_limit: 2 }), { ...opts, customerUsageCount: 1 })
    ).not.toThrow();
  });
});

describe('effectiveState', () => {
  const now = new Date('2026-06-01');

  it('đang trong hạn và còn lượt → RUNNING', () => {
    expect(effectiveState(base(), now)).toBe('RUNNING');
  });

  it('bị tắt → INACTIVE (ưu tiên cao nhất)', () => {
    expect(effectiveState(base({ status: 'INACTIVE', end_date: new Date('2020-01-01') }), now)).toBe(
      'INACTIVE'
    );
  });

  it('chưa tới ngày bắt đầu → SCHEDULED', () => {
    expect(effectiveState(base({ start_date: new Date('2026-12-01') }), now)).toBe('SCHEDULED');
  });

  it('quá hạn → EXPIRED', () => {
    expect(effectiveState(base({ end_date: new Date('2026-01-01') }), now)).toBe('EXPIRED');
  });

  it('hết lượt nhưng còn hạn → EXHAUSTED', () => {
    expect(effectiveState(base({ usage_limit: 10, used_count: 10 }), now)).toBe('EXHAUSTED');
  });
});
