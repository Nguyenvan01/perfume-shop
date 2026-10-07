import { describe, expect, it } from 'vitest';
import {
  niceTicks,
  makeYScale,
  bandCenter,
  columnWidth,
  nearestIndex,
  compactCurrency,
  compactNumber,
} from './scale';

describe('niceTicks — mốc trục phải là số tròn', () => {
  it('sinh mốc tròn, luôn bắt đầu từ 0', () => {
    const ticks = niceTicks(2300);
    expect(ticks[0]).toBe(0);
    expect(ticks).toEqual([0, 1000, 2000, 3000]);
  });

  it('mốc cuối luôn phủ hết giá trị lớn nhất', () => {
    for (const max of [1, 7, 99, 1234, 56_789, 4_150_000, 987_654_321]) {
      const ticks = niceTicks(max);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
    }
  });

  it('khoảng cách giữa các mốc đều nhau', () => {
    const ticks = niceTicks(4_150_000);
    const gaps = ticks.slice(1).map((tick, i) => tick - ticks[i]);
    expect(new Set(gaps).size).toBe(1);
  });

  it('không sinh sai số dấu phẩy động', () => {
    const ticks = niceTicks(0.9);
    expect(ticks.every((tick) => String(tick).length < 8)).toBe(true);
  });

  it('max = 0 hoặc âm hoặc không phải số → trả thang tối thiểu, không nổ', () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(-5)).toEqual([0, 1]);
    expect(niceTicks(NaN)).toEqual([0, 1]);
    expect(niceTicks(undefined)).toEqual([0, 1]);
  });
});

describe('makeYScale', () => {
  const scale = makeYScale({ max: 100, top: 10, height: 200 });

  it('giá trị 0 nằm ở đáy vùng vẽ', () => {
    expect(scale(0)).toBe(210);
  });

  it('giá trị max nằm ở đỉnh vùng vẽ', () => {
    expect(scale(100)).toBe(10);
  });

  it('tuyến tính ở giữa', () => {
    expect(scale(50)).toBe(110);
  });

  it('giá trị âm bị kẹp về 0, không vẽ ra ngoài vùng', () => {
    expect(scale(-20)).toBe(210);
  });

  it('max = 0 không gây chia cho 0', () => {
    const zeroScale = makeYScale({ max: 0, top: 0, height: 100 });
    expect(Number.isFinite(zeroScale(0))).toBe(true);
  });
});

describe('bandCenter', () => {
  it('chia đều và đặt mark ở tâm band', () => {
    expect(bandCenter({ index: 0, count: 4, left: 0, width: 400 })).toBe(50);
    expect(bandCenter({ index: 3, count: 4, left: 0, width: 400 })).toBe(350);
  });

  it('tôn trọng lề trái', () => {
    // width 200 / 2 band = bandWidth 100 → tâm band đầu = 56 + 50
    expect(bandCenter({ index: 0, count: 2, left: 56, width: 200 })).toBe(106);
    expect(bandCenter({ index: 1, count: 2, left: 56, width: 200 })).toBe(206);
  });

  it('count = 0 không chia cho 0', () => {
    expect(bandCenter({ index: 0, count: 0, left: 10, width: 100 })).toBe(10);
  });
});

describe('columnWidth — cột không bao giờ lấp kín band', () => {
  it('luôn nhỏ hơn bề rộng band để còn khoảng trống', () => {
    const width = columnWidth({ count: 10, width: 400 });
    expect(width).toBeLessThan(40);
  });

  it('bị chặn ở 24px theo mark spec dù band rất rộng', () => {
    expect(columnWidth({ count: 1, width: 700 })).toBe(24);
  });

  it('nhiều điểm vẫn giữ bề rộng tối thiểu để còn thấy được', () => {
    expect(columnWidth({ count: 200, width: 400 })).toBeGreaterThanOrEqual(2);
  });

  it('count = 0 → 0, không nổ', () => {
    expect(columnWidth({ count: 0, width: 400 })).toBe(0);
  });
});

describe('nearestIndex — dùng cho crosshair', () => {
  const geometry = { count: 4, left: 0, width: 400 };

  it('tìm đúng band theo toạ độ chuột', () => {
    expect(nearestIndex({ x: 10, ...geometry })).toBe(0);
    expect(nearestIndex({ x: 150, ...geometry })).toBe(1);
    expect(nearestIndex({ x: 390, ...geometry })).toBe(3);
  });

  it('chuột ra ngoài vùng vẽ vẫn kẹp vào band đầu/cuối', () => {
    expect(nearestIndex({ x: -100, ...geometry })).toBe(0);
    expect(nearestIndex({ x: 9999, ...geometry })).toBe(3);
  });

  it('không có dữ liệu → -1', () => {
    expect(nearestIndex({ x: 10, count: 0, left: 0, width: 400 })).toBe(-1);
  });
});

describe('compactCurrency — nhãn trục tiền', () => {
  it('rút gọn theo đơn vị tiếng Việt, dùng dấu phẩy thập phân', () => {
    expect(compactCurrency(4_150_000)).toBe('4,2 tr');
    expect(compactCurrency(1_250_000_000)).toBe('1,3 tỷ');
    expect(compactCurrency(850_000)).toBe('850 k');
    expect(compactCurrency(500)).toBe('500');
  });

  it('0 và giá trị rỗng → "0"', () => {
    expect(compactCurrency(0)).toBe('0');
    expect(compactCurrency(null)).toBe('0');
    expect(compactCurrency(undefined)).toBe('0');
  });

  it('nhận string Decimal từ backend', () => {
    expect(compactCurrency('4150000.00')).toBe('4,2 tr');
  });
});

describe('compactNumber — nhãn trục số đếm', () => {
  it('rút gọn nghìn và triệu', () => {
    expect(compactNumber(1200)).toBe('1,2 N');
    expect(compactNumber(2_500_000)).toBe('2,5 tr');
    expect(compactNumber(42)).toBe('42');
  });
});
