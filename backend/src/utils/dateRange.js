'use strict';

const AppError = require('./AppError');
const env = require('./../config/env');

/**
 * Báo cáo phải tính theo ngày ở múi giờ Việt Nam, không phải UTC.
 * Nếu dùng UTC thì "doanh thu hôm nay" bị lệch 7 tiếng mỗi ngày: đơn đặt lúc
 * 8h sáng VN sẽ bị tính sang ngày hôm trước.
 */
const OFFSET_HOURS = env.REPORT_TIMEZONE_OFFSET;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Lấy y/m/d theo giờ địa phương từ một mốc UTC. */
function localDateParts(date) {
  const shifted = new Date(date.getTime() + OFFSET_HOURS * HOUR_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

/** Nửa đêm giờ địa phương, trả về mốc UTC tương ứng để query DB. */
function localMidnightUtc({ year, month, day }) {
  return new Date(Date.UTC(year, month, day) - OFFSET_HOURS * HOUR_MS);
}

const RANGES = ['today', '7d', '30d', 'this_month', 'custom'];

/**
 * Chuẩn hoá `?range=` thành cặp [from, to) để query.
 * Khoảng nửa mở: from <= created_at < to — tránh lỗi biên khi dùng <= to
 * với giá trị datetime có phần giây/ms.
 */
function resolveRange({ range = '30d', from, to } = {}, now = new Date()) {
  if (!RANGES.includes(range)) {
    throw AppError.badRequest(`Invalid range. Expected one of: ${RANGES.join(', ')}`);
  }

  const today = localDateParts(now);
  const startOfToday = localMidnightUtc(today);
  const startOfTomorrow = new Date(startOfToday.getTime() + DAY_MS);

  if (range === 'custom') {
    if (!from || !to) throw AppError.badRequest('range=custom requires both from and to');
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw AppError.badRequest('Invalid date range');
    }
    if (fromDate > toDate) throw AppError.badRequest('from must not be after to');

    // Lấy trọn cả ngày `to` theo giờ địa phương.
    const toStart = localMidnightUtc(localDateParts(toDate));
    return {
      range,
      from: localMidnightUtc(localDateParts(fromDate)),
      to: new Date(toStart.getTime() + DAY_MS),
    };
  }

  if (range === 'today') return { range, from: startOfToday, to: startOfTomorrow };

  if (range === '7d') {
    return { range, from: new Date(startOfTomorrow.getTime() - 7 * DAY_MS), to: startOfTomorrow };
  }

  if (range === '30d') {
    return { range, from: new Date(startOfTomorrow.getTime() - 30 * DAY_MS), to: startOfTomorrow };
  }

  // this_month
  return {
    range,
    from: localMidnightUtc({ ...today, day: 1 }),
    to: startOfTomorrow,
  };
}

/** Khoảng liền trước cùng độ dài — dùng để tính % tăng/giảm. */
function previousRange({ from, to }) {
  const span = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - span), to: new Date(from.getTime()) };
}

/** Đếm số ngày trong khoảng, để biết nên group theo ngày hay theo tháng. */
const daysInRange = ({ from, to }) => Math.round((to.getTime() - from.getTime()) / DAY_MS);

module.exports = { resolveRange, previousRange, daysInRange, OFFSET_HOURS, RANGES };
