/**
 * Token màu cho biểu đồ.
 *
 * Màu chuỗi dữ liệu đã chạy qua validator của skill dataviz trên đúng surface
 * của app (#ffffff, nền Card của Ant Design): đạt cả 5 kiểm tra — dải độ sáng,
 * sàn chroma, và tương phản >= 3:1 so với surface.
 *
 * Mọi biểu đồ ở đây chỉ có MỘT chuỗi dữ liệu (doanh thu, số đơn, số lượng bán...),
 * nên không cần palette phân loại và không cần legend — tiêu đề biểu đồ đã nói
 * rõ đang vẽ cái gì.
 */
export const CHART = {
  surface: '#ffffff',
  series: '#2a78d6',
  // Vùng tô dưới đường: chính màu chuỗi ở ~10% — một lớp wash, không phải khối đặc.
  seriesWash: 'rgba(42, 120, 214, 0.10)',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  textPrimary: '#0b0b0b',
  textSecondary: '#52514e',
  textMuted: '#898781',
};

/** Spec mark cố định (skill dataviz § Marks). */
export const MARK = {
  lineWidth: 2,
  barMaxThickness: 24,
  barRadius: 4,
  markerRadius: 4,
  surfaceGap: 2,
  surfaceRing: 2,
  gridWidth: 1,
};

export const AXIS_FONT = 11;
export const LABEL_FONT = 12;
