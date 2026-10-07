import { Descriptions, Typography } from 'antd';
import { formatCurrency } from '../../../utils/format';

const { Text } = Typography;

/** Bảng tiền dùng chung cho giỏ hàng, trang thanh toán và chi tiết đơn. */
export default function OrderSummary({
  subtotal,
  discountAmount,
  shippingFee,
  totalAmount,
  promotionCode,
}) {
  const items = [
    { key: 'subtotal', label: 'Tạm tính', children: formatCurrency(subtotal) },
    {
      key: 'discount',
      label: promotionCode ? `Giảm giá (${promotionCode})` : 'Giảm giá',
      children: (
        <Text type={Number(discountAmount) > 0 ? 'success' : undefined}>
          {Number(discountAmount) > 0 ? `− ${formatCurrency(discountAmount)}` : formatCurrency(0)}
        </Text>
      ),
    },
    { key: 'shipping', label: 'Phí vận chuyển', children: formatCurrency(shippingFee) },
    {
      key: 'total',
      label: 'Tổng cộng',
      children: (
        <Text strong style={{ fontSize: 18, color: '#8c5a3b' }}>
          {formatCurrency(totalAmount)}
        </Text>
      ),
    },
  ];

  return <Descriptions column={1} size="small" items={items} />;
}
