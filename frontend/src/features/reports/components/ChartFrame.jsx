import { Typography } from 'antd';
import { EmptyState } from '../../../components';
import { CHART, AXIS_FONT, MARK } from './chartTokens';
import { niceTicks, makeYScale } from './scale';

const { Text } = Typography;

/**
 * Khung chung cho biểu đồ: lưới, trục y có mốc làm tròn, nhãn trục x.
 * `children(ctx)` nhận sẵn vùng vẽ và hàm thang đo, nên từng loại biểu đồ chỉ
 * phải lo phần mark của nó.
 */
export default function ChartFrame({
  data,
  valueOf,
  labelOf,
  formatTick,
  height = 240,
  width = 720,
  padding = { top: 16, right: 16, bottom: 28, left: 56 },
  emptyDescription = 'Chưa có dữ liệu trong khoảng thời gian này',
  children,
  onMouseMove,
  onMouseLeave,
  svgRef,
}) {
  if (!data || data.length === 0) return <EmptyState description={emptyDescription} />;

  const plotLeft = padding.left;
  const plotTop = padding.top;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const max = Math.max(...data.map(valueOf), 0);
  const ticks = niceTicks(max);
  const scaleMax = ticks[ticks.length - 1];
  const yScale = makeYScale({ max: scaleMax, top: plotTop, height: plotHeight });

  // Nhãn trục x thưa dần khi nhiều điểm, để chữ không chồng nhau.
  const labelEvery = Math.ceil(data.length / 10);

  const ctx = { plotLeft, plotTop, plotWidth, plotHeight, yScale, scaleMax, data };

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        style={{ display: 'block', minWidth: 320 }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {/* Lưới: hairline 1px, liền, lùi về sau dữ liệu */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={plotLeft}
              x2={plotLeft + plotWidth}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke={tick === 0 ? CHART.axis : CHART.grid}
              strokeWidth={MARK.gridWidth}
            />
            <text
              x={plotLeft - 8}
              y={yScale(tick) + 4}
              textAnchor="end"
              fontSize={AXIS_FONT}
              fill={CHART.textMuted}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatTick(tick)}
            </text>
          </g>
        ))}

        {children(ctx)}

        {/* Nhãn trục x */}
        {data.map((item, index) => {
          if (index % labelEvery !== 0 && index !== data.length - 1) return null;
          const bandWidth = plotWidth / data.length;
          return (
            <text
              key={`x-${index}`}
              x={plotLeft + bandWidth * index + bandWidth / 2}
              y={height - 8}
              textAnchor="middle"
              fontSize={AXIS_FONT}
              fill={CHART.textMuted}
            >
              {labelOf(item, index)}
            </text>
          );
        })}
      </svg>
      <Text type="secondary" style={{ fontSize: 11 }}>
        Giá trị chi tiết xem ở bảng bên dưới hoặc khi trỏ vào biểu đồ.
      </Text>
    </div>
  );
}
