import { Tag } from 'antd';
import { formatNumber } from '../../../utils/format';

/**
 * Hiển thị tồn kho với màu theo mức độ. Dùng lại ở trang kho, sản phẩm và
 * dashboard để một con số tồn kho luôn trông giống nhau ở mọi nơi.
 */
export default function StockTag({ quantity, threshold = 5 }) {
  if (quantity === 0) return <Tag color="red">Hết hàng</Tag>;
  if (quantity <= threshold) return <Tag color="orange">Còn {formatNumber(quantity)}</Tag>;
  return <Tag color="green">{formatNumber(quantity)}</Tag>;
}
