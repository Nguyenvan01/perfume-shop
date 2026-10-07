import { CHART, LABEL_FONT } from './chartTokens';

/**
 * Tooltip theo con trỏ. Dùng div tuyệt đối thay vì <title> của SVG để hiện
 * ngay, không phải chờ delay của native tooltip.
 */
export default function ChartTooltip({ visible, x, y, title, rows }) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -115%)',
        pointerEvents: 'none',
        background: CHART.surface,
        border: `1px solid rgba(11,11,11,0.10)`,
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        padding: '8px 10px',
        fontSize: LABEL_FONT,
        whiteSpace: 'nowrap',
        zIndex: 5,
      }}
    >
      <div style={{ color: CHART.textSecondary, marginBottom: 4 }}>{title}</div>
      {rows.map((row) => (
        <div key={row.label} style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {/* Chấm màu mang danh tính, chữ dùng token text — không bao giờ tô màu chữ. */}
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: CHART.series,
                display: 'inline-block',
              }}
            />
            <span style={{ color: CHART.textSecondary }}>{row.label}</span>
          </span>
          <strong style={{ color: CHART.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
            {row.value}
          </strong>
        </div>
      ))}
    </div>
  );
}
