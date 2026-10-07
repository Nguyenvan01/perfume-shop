import { Table, Typography } from 'antd';
import { formatCurrency } from '../../../utils/format';

const { Text } = Typography;

/**
 * Chi tiết đơn lấy từ snapshot trong order_details, không join lại bảng sản phẩm
 * — nên đơn cũ luôn hiện đúng giá tại thời điểm đặt.
 */
export default function OrderItemsTable({ details }) {
  const columns = [
    {
      title: 'Sản phẩm',
      key: 'product',
      render: (_value, row) => (
        <>
          <Text strong>{row.product_name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            <code>{row.sku}</code> · {row.volume_ml}ml
          </Text>
        </>
      ),
    },
    {
      title: 'Đơn giá',
      dataIndex: 'unit_price',
      key: 'unit_price',
      align: 'right',
      render: formatCurrency,
    },
    { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity', align: 'right' },
    {
      title: 'Thành tiền',
      dataIndex: 'line_total',
      key: 'line_total',
      align: 'right',
      render: (value) => <Text strong>{formatCurrency(value)}</Text>,
    },
  ];

  return (
    <Table
      size="small"
      rowKey="id"
      columns={columns}
      dataSource={details}
      pagination={false}
      scroll={{ x: 'max-content' }}
    />
  );
}
