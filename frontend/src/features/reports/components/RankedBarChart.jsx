import { useState } from 'react';
import { Typography } from 'antd';
import { EmptyState } from '../../../components';
import ChartTooltip from './ChartTooltip';
import { CHART, MARK, AXIS_FONT } from './chartTokens';

const { Text } = Typography;

const ROW_HEIGHT = 30;
const BAR_THICKNESS = Math.min(20, MARK.barMaxThickness);
const LABEL_WIDTH = 170;
const VALUE_WIDTH = 92;

/**
 * Bar ngang cho dữ liệu xếp hạng (top sản phẩm, doanh thu theo thương hiệu).
 * Bar ngang thay vì cột vì nhãn là tên dài — nằm ngang thì đọc được, không
 * phải xoay chữ.
 *
 * Giá trị được gắn thẳng ở đầu bar, nên biểu đồ này không cần trục giá trị.
 */
export default function RankedBarChart({
  data,
  valueOf,
  labelOf,
  subLabelOf,
  formatValue,
  tooltipLabel,
  emptyDescription = 'Chưa có dữ liệu trong khoảng thời gian này',
}) {
  const [hover, setHover] = useState(null);

  if (!data || data.length === 0) return <EmptyState description={emptyDescription} />;

  const max = Math.max(...data.map(valueOf), 0);
  const trackWidth = 320;
  const width = LABEL_WIDTH + trackWidth + VALUE_WIDTH;
  const height = data.length * ROW_HEIGHT + 8;

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        style={{ display: 'block', minWidth: 420 }}
        onMouseLeave={() => setHover(null)}
      >
        {data.map((item, index) => {
          const value = valueOf(item);
          const barWidth = max > 0 ? Math.max((value / max) * trackWidth, value > 0 ? 3 : 0) : 0;
          const y = index * ROW_HEIGHT + 4;
          const barY = y + (ROW_HEIGHT - BAR_THICKNESS) / 2;

          return (
            <g
              key={index}
              onMouseEnter={(event) => {
                const rect = event.currentTarget.ownerSVGElement.getBoundingClientRect();
                const scale = width / rect.width;
                setHover({
                  index,
                  pixelX: (LABEL_WIDTH + barWidth) / scale,
                  pixelY: (barY + BAR_THICKNESS / 2) / scale,
                });
              }}
            >
              {/* Hit target cao bằng cả dòng, rộng hơn bar */}
              <rect x={0} y={y} width={width} height={ROW_HEIGHT} fill="transparent" />

              <text
                x={LABEL_WIDTH - 10}
                y={barY + BAR_THICKNESS / 2 + 4}
                textAnchor="end"
                fontSize={AXIS_FONT + 1}
                fill={CHART.textSecondary}
              >
                {/* Cắt nhãn dài: thà cắt ở nguồn còn hơn để chữ tràn ra ngoài mark */}
                {String(labelOf(item)).length > 26
                  ? `${String(labelOf(item)).slice(0, 25)}…`
                  : labelOf(item)}
              </text>

              <rect
                x={LABEL_WIDTH}
                y={barY}
                width={barWidth}
                height={BAR_THICKNESS}
                rx={MARK.barRadius}
                fill={CHART.series}
                opacity={hover && hover.index !== index ? 0.55 : 1}
              />

              {/* Giá trị gắn ở đầu bar — nhãn trực tiếp, không cần trục */}
              <text
                x={LABEL_WIDTH + barWidth + 8}
                y={barY + BAR_THICKNESS / 2 + 4}
                fontSize={AXIS_FONT + 1}
                fill={CHART.textPrimary}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatValue(value)}
              </text>
            </g>
          );
        })}
      </svg>

      <ChartTooltip
        visible={Boolean(hover)}
        x={hover?.pixelX ?? 0}
        y={hover?.pixelY ?? 0}
        title={hover ? labelOf(data[hover.index]) : ''}
        rows={
          hover
            ? [
                { label: tooltipLabel, value: formatValue(valueOf(data[hover.index])) },
                ...(subLabelOf
                  ? [{ label: subLabelOf(data[hover.index]).label, value: subLabelOf(data[hover.index]).value }]
                  : []),
              ]
            : []
        }
      />

      <Text type="secondary" style={{ fontSize: 11 }}>
        Xếp theo giá trị giảm dần.
      </Text>
    </div>
  );
}
