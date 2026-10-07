import { Flex, Progress, Rate, Typography } from 'antd';
import { formatNumber } from '../../../utils/format';

const { Text, Title } = Typography;

/**
 * Điểm trung bình + phân bố số sao.
 * Thanh phân bố luôn hiện đủ 5 bậc (kể cả bậc 0) để chiều cao khối không nhảy
 * khi sản phẩm có thêm đánh giá mới.
 */
export default function RatingSummary({ summary }) {
  const total = summary?.total ?? 0;

  if (total === 0) {
    return (
      <Flex vertical gap={4}>
        <Text type="secondary">Chưa có đánh giá nào</Text>
        <Rate disabled value={0} />
      </Flex>
    );
  }

  return (
    <Flex gap={32} wrap align="center">
      <Flex vertical align="center" gap={2} style={{ minWidth: 110 }}>
        <Title level={2} style={{ margin: 0 }}>
          {summary.average.toFixed(1)}
        </Title>
        <Rate disabled allowHalf value={summary.average} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatNumber(total)} đánh giá
        </Text>
      </Flex>

      <Flex vertical gap={2} style={{ flex: 1, minWidth: 220 }}>
        {summary.breakdown.map((row) => (
          <Flex key={row.rating} align="center" gap={8}>
            <Text style={{ width: 34, fontSize: 12 }}>{row.rating} sao</Text>
            <Progress
              percent={total > 0 ? Math.round((row.count / total) * 100) : 0}
              size="small"
              showInfo={false}
              style={{ flex: 1, marginBottom: 0 }}
            />
            <Text type="secondary" style={{ width: 28, fontSize: 12, textAlign: 'right' }}>
              {row.count}
            </Text>
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
}
