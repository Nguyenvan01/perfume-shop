import { Tag, Tooltip } from 'antd';

/**
 * Trạng thái hiệu lực do backend suy ra từ ngày + status + lượt dùng.
 * Mỗi nhãn có chữ riêng, không chỉ dựa vào màu.
 */
const STATE = {
  RUNNING: { color: 'green', label: 'Đang chạy', hint: 'Khách áp được mã này ngay bây giờ' },
  SCHEDULED: { color: 'blue', label: 'Chưa bắt đầu', hint: 'Sẽ tự có hiệu lực khi tới ngày bắt đầu' },
  EXPIRED: { color: 'default', label: 'Đã hết hạn', hint: 'Đã qua ngày kết thúc' },
  EXHAUSTED: { color: 'orange', label: 'Hết lượt', hint: 'Đã dùng hết số lượt cho phép' },
  INACTIVE: { color: 'default', label: 'Đã tắt', hint: 'Bị tắt thủ công' },
};

export default function PromotionStateTag({ state }) {
  const config = STATE[state] ?? { color: 'default', label: state, hint: '' };
  return (
    <Tooltip title={config.hint}>
      <Tag color={config.color}>{config.label}</Tag>
    </Tooltip>
  );
}
