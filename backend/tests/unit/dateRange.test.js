'use strict';

const { resolveRange, previousRange, daysInRange } = require('../../src/utils/dateRange');

// 2026-10-07T03:00Z = 10h sáng ngày 7/10 giờ Việt Nam
const NOW = new Date('2026-10-07T03:00:00.000Z');

describe('resolveRange — tính theo ngày giờ Việt Nam, không theo UTC', () => {
  it('today bắt đầu từ 00:00 giờ VN (= 17:00Z hôm trước)', () => {
    const { from, to } = resolveRange({ range: 'today' }, NOW);
    expect(from.toISOString()).toBe('2026-10-06T17:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-07T17:00:00.000Z');
    expect(daysInRange({ from, to })).toBe(1);
  });

  it('đơn đặt 8h sáng VN vẫn nằm trong "today"', () => {
    const { from, to } = resolveRange({ range: 'today' }, NOW);
    const orderAt8am = new Date('2026-10-07T01:00:00.000Z'); // 8h sáng VN
    expect(orderAt8am >= from && orderAt8am < to).toBe(true);
  });

  it('đơn đặt 23h đêm VN hôm trước KHÔNG nằm trong "today"', () => {
    const { from } = resolveRange({ range: 'today' }, NOW);
    const lateLastNight = new Date('2026-10-06T16:00:00.000Z'); // 23h VN ngày 6
    expect(lateLastNight < from).toBe(true);
  });

  it('7d và 30d đúng độ dài', () => {
    expect(daysInRange(resolveRange({ range: '7d' }, NOW))).toBe(7);
    expect(daysInRange(resolveRange({ range: '30d' }, NOW))).toBe(30);
  });

  it('this_month bắt đầu từ ngày 1 giờ VN', () => {
    const { from } = resolveRange({ range: 'this_month' }, NOW);
    expect(from.toISOString()).toBe('2026-09-30T17:00:00.000Z'); // 00:00 ngày 1/10 VN
  });

  it('custom lấy trọn cả ngày `to`', () => {
    const { from, to } = resolveRange(
      { range: 'custom', from: '2026-10-01', to: '2026-10-05' },
      NOW
    );
    expect(from.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-05T17:00:00.000Z');
    // Đơn lúc 23h ngày 5/10 VN vẫn được tính.
    expect(new Date('2026-10-05T16:00:00.000Z') < to).toBe(true);
  });

  it('mặc định là 30d khi không truyền range', () => {
    expect(resolveRange({}, NOW).range).toBe('30d');
  });

  it('range lạ → 400', () => {
    expect(() => resolveRange({ range: 'last_year' }, NOW)).toThrow(/Invalid range/);
  });

  it('custom thiếu from hoặc to → 400', () => {
    expect(() => resolveRange({ range: 'custom', from: '2026-10-01' }, NOW)).toThrow(/requires both/);
    expect(() => resolveRange({ range: 'custom' }, NOW)).toThrow(/requires both/);
  });

  it('custom với from > to → 400', () => {
    expect(() =>
      resolveRange({ range: 'custom', from: '2026-10-09', to: '2026-10-01' }, NOW)
    ).toThrow(/must not be after/);
  });

  it('ngày không hợp lệ → 400', () => {
    expect(() => resolveRange({ range: 'custom', from: 'hôm qua', to: 'hôm nay' }, NOW)).toThrow(
      /Invalid date range/
    );
  });
});

describe('previousRange', () => {
  it('cùng độ dài, nằm liền trước', () => {
    const current = resolveRange({ range: '7d' }, NOW);
    const previous = previousRange(current);

    expect(daysInRange(previous)).toBe(7);
    expect(previous.to.getTime()).toBe(current.from.getTime());
  });
});
