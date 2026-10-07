import { Card, Flex, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * Ô số liệu: khi dữ liệu là MỘT con số thì con số là hình thức đúng,
 * không cần biểu đồ.
 *
 * `changePct` null nghĩa là kỳ trước bằng 0 — không so sánh được, hiện "—"
 * chứ không hiện 0% (0% sai nghĩa: 0% là "không đổi", null là "không có gốc so").
 */
export default function StatTile({ label, value, suffix, changePct, hint, loading, danger }) {
  const hasChange = changePct !== undefined && changePct !== null;
  const isUp = hasChange && changePct > 0;
  const isDown = hasChange && changePct < 0;

  // Màu delta là màu trạng thái, luôn đi kèm icon — không bao giờ chỉ dựa vào màu.
  const deltaColor = isUp ? '#006300' : isDown ? '#d03b3b' : '#898781';
  const DeltaIcon = isUp ? ArrowUpOutlined : isDown ? ArrowDownOutlined : MinusOutlined;

  return (
    <Card loading={loading} styles={{ body: { padding: 16 } }}>
      <Flex vertical gap={4}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {label}
        </Text>

        <Flex align="baseline" gap={6} wrap>
          <Text
            strong
            style={{
              fontSize: 24,
              lineHeight: 1.2,
              color: danger ? '#d03b3b' : '#0b0b0b',
            }}
          >
            {value}
          </Text>
          {suffix && <Text type="secondary">{suffix}</Text>}
        </Flex>

        {changePct !== undefined && (
          <Flex align="center" gap={4}>
            <DeltaIcon style={{ fontSize: 11, color: deltaColor }} />
            <Text style={{ fontSize: 12, color: deltaColor }}>
              {hasChange ? `${Math.abs(changePct)}%` : '—'}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {hasChange ? 'so với kỳ trước' : 'kỳ trước không có dữ liệu'}
            </Text>
          </Flex>
        )}

        {hint && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {hint}
          </Text>
        )}
      </Flex>
    </Card>
  );
}
