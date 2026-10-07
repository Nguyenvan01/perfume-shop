import { useRef, useState } from 'react';
import ChartFrame from './ChartFrame';
import ChartTooltip from './ChartTooltip';
import { CHART, MARK } from './chartTokens';
import { bandCenter, columnWidth, nearestIndex } from './scale';

/**
 * Chuỗi thời gian: vẽ dạng `line` (doanh thu) hoặc `column` (số đơn).
 * Một chuỗi duy nhất nên không có legend; tiêu đề Card đã nói rõ đang vẽ gì.
 * Hai thước đo khác đơn vị thì tách thành hai biểu đồ — không bao giờ hai trục y.
 */
export default function TimeSeriesChart({
  data,
  valueOf,
  labelOf,
  formatTick,
  formatValue,
  tooltipLabel,
  variant = 'line',
  height = 240,
}) {
  const containerRef = useRef(null);
  const [hover, setHover] = useState(null);

  const handleMouseMove = (event, ctx) => {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    // Quy đổi toạ độ chuột sang hệ viewBox để khớp với vùng vẽ.
    const scaleX = 720 / rect.width;
    const x = (event.clientX - rect.left) * scaleX;

    const index = nearestIndex({
      x,
      count: data.length,
      left: ctx.plotLeft,
      width: ctx.plotWidth,
    });
    if (index < 0) return;

    const cx = bandCenter({ index, count: data.length, left: ctx.plotLeft, width: ctx.plotWidth });
    setHover({
      index,
      // Đổi lại về pixel của container để đặt tooltip.
      pixelX: cx / scaleX,
      pixelY: ctx.yScale(valueOf(data[index])) / scaleX,
    });
  };

  return (
    <div style={{ position: 'relative' }} ref={containerRef}>
      <ChartFrame
        data={data}
        valueOf={valueOf}
        labelOf={labelOf}
        formatTick={formatTick}
        height={height}
        onMouseLeave={() => setHover(null)}
      >
        {(ctx) => {
          const points = data.map((item, index) => ({
            x: bandCenter({
              index,
              count: data.length,
              left: ctx.plotLeft,
              width: ctx.plotWidth,
            }),
            y: ctx.yScale(valueOf(item)),
          }));

          return (
            <g>
              {/* Lớp bắt chuột phủ toàn vùng vẽ: hit target rộng hơn mark */}
              <rect
                x={ctx.plotLeft}
                y={ctx.plotTop}
                width={ctx.plotWidth}
                height={ctx.plotHeight}
                fill="transparent"
                onMouseMove={(event) => handleMouseMove(event, ctx)}
              />

              {variant === 'column'
                ? data.map((item, index) => {
                    const barWidth = columnWidth({ count: data.length, width: ctx.plotWidth });
                    const y = ctx.yScale(valueOf(item));
                    const barHeight = ctx.plotTop + ctx.plotHeight - y;
                    return (
                      <rect
                        key={index}
                        x={points[index].x - barWidth / 2}
                        y={y}
                        width={barWidth}
                        height={Math.max(barHeight, valueOf(item) > 0 ? 2 : 0)}
                        // Bo 4px ở đầu dữ liệu, vuông ở chân cột
                        rx={MARK.barRadius}
                        fill={CHART.series}
                      />
                    );
                  })
                : null}

              {variant === 'line' && points.length > 0 && (
                <>
                  {/* Vùng tô ~10%: một lớp wash, không phải khối đặc */}
                  <path
                    d={`M ${points[0].x} ${ctx.plotTop + ctx.plotHeight} ${points
                      .map((p) => `L ${p.x} ${p.y}`)
                      .join(' ')} L ${points[points.length - 1].x} ${ctx.plotTop + ctx.plotHeight} Z`}
                    fill={CHART.seriesWash}
                  />
                  <path
                    d={points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                    fill="none"
                    stroke={CHART.series}
                    strokeWidth={MARK.lineWidth}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {/* Chỉ gắn marker ở điểm cuối — nhãn thưa mới có tác dụng */}
                  <circle
                    cx={points[points.length - 1].x}
                    cy={points[points.length - 1].y}
                    r={MARK.markerRadius}
                    fill={CHART.series}
                    stroke={CHART.surface}
                    strokeWidth={MARK.surfaceRing}
                  />
                </>
              )}

              {/* Crosshair khi trỏ vào */}
              {hover && (
                <>
                  <line
                    x1={points[hover.index].x}
                    x2={points[hover.index].x}
                    y1={ctx.plotTop}
                    y2={ctx.plotTop + ctx.plotHeight}
                    stroke={CHART.axis}
                    strokeWidth={1}
                  />
                  <circle
                    cx={points[hover.index].x}
                    cy={points[hover.index].y}
                    r={MARK.markerRadius}
                    fill={CHART.series}
                    stroke={CHART.surface}
                    strokeWidth={MARK.surfaceRing}
                  />
                </>
              )}
            </g>
          );
        }}
      </ChartFrame>

      <ChartTooltip
        visible={Boolean(hover)}
        x={hover?.pixelX ?? 0}
        y={hover?.pixelY ?? 0}
        title={hover ? labelOf(data[hover.index], hover.index) : ''}
        rows={
          hover
            ? [{ label: tooltipLabel, value: formatValue(valueOf(data[hover.index])) }]
            : []
        }
      />
    </div>
  );
}
