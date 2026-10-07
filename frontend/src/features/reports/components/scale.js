/**
 * Toán học thang đo cho biểu đồ SVG tự vẽ.
 * Tách riêng khỏi component vì đây là chỗ biểu đồ tay dễ sai nhất,
 * và tách ra thì test được bằng số thay vì mắt.
 */

const NICE_STEPS = [1, 2, 2.5, 5, 10];

/**
 * Sinh mốc trục y "đẹp" (0 / 1.000 / 2.000) phủ hết [0, max].
 * Luôn bắt đầu từ 0: cột/đường đo độ lớn thì baseline phải là 0.
 */
export function niceTicks(max, targetCount = 4) {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];

  const rough = max / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));

  const step =
    (NICE_STEPS.find((candidate) => candidate * magnitude >= rough) ?? 10) * magnitude;

  const ticks = [];
  for (let value = 0; value <= max + step / 1000; value += step) {
    // Làm tròn để tránh sai số dấu phẩy động dồn lại (0.30000000000000004).
    ticks.push(Number(value.toFixed(10)));
  }
  // Đảm bảo mốc cuối phủ hết max.
  if (ticks[ticks.length - 1] < max) ticks.push(Number((ticks[ticks.length - 1] + step).toFixed(10)));

  return ticks;
}

/** Hàm đổi giá trị dữ liệu thành toạ độ y trong vùng vẽ. */
export function makeYScale({ max, top, height }) {
  const safeMax = max > 0 ? max : 1;
  return (value) => top + height - (Math.max(0, value) / safeMax) * height;
}

/** Toạ độ tâm của band thứ i khi chia đều vùng vẽ thành `count` band. */
export function bandCenter({ index, count, left, width }) {
  if (count <= 0) return left;
  const bandWidth = width / count;
  return left + bandWidth * index + bandWidth / 2;
}

/**
 * Bề rộng cột: không bao giờ lấp kín band (để lại khoảng trống),
 * tối đa 24px theo mark spec, và trừ 2px làm khe phân cách giữa hai cột cạnh nhau.
 */
export function columnWidth({ count, width, maxThickness = 24, gap = 2 }) {
  if (count <= 0) return 0;
  const bandWidth = width / count;
  return Math.max(2, Math.min(maxThickness, bandWidth * 0.7 - gap));
}

/** Tìm index band gần nhất với toạ độ x — dùng cho crosshair. */
export function nearestIndex({ x, count, left, width }) {
  if (count <= 0) return -1;
  const bandWidth = width / count;
  const index = Math.floor((x - left) / bandWidth);
  return Math.min(count - 1, Math.max(0, index));
}

/** Rút gọn số tiền cho nhãn trục: 1.250.000 → "1,3 tr". */
export function compactCurrency(value) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '0';
  const abs = Math.abs(amount);

  if (abs >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1).replace('.', ',')} tỷ`;
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.', ',')} tr`;
  if (abs >= 1_000) return `${Math.round(amount / 1_000)} k`;
  return String(Math.round(amount));
}

/** Rút gọn số đếm: 1200 → "1,2 N". */
export function compactNumber(value) {
  const amount = Number(value ?? 0);
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.', ',')} tr`;
  if (Math.abs(amount) >= 1_000) return `${(amount / 1_000).toFixed(1).replace('.', ',')} N`;
  return String(Math.round(amount));
}
