import { useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Descriptions, Flex, Row, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ordersApi } from '../../api/orders';
import { PageHeader, QueryBoundary } from '../../components';
import { formatDateTime, formatLabel } from '../../utils/format';
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from '../../utils/constants';
import OrderStatusTag from '../../features/orders/components/OrderStatusTag';
import OrderTimeline from '../../features/orders/components/OrderTimeline';
import OrderItemsTable from '../../features/orders/components/OrderItemsTable';
import OrderSummary from '../../features/orders/components/OrderSummary';
import OrderActions from '../../features/orders/components/OrderActions';

const { Text } = Typography;

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const orderQuery = useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn: () => ordersApi.detail(id),
  });

  return (
    <QueryBoundary query={orderQuery} skeletonRows={10}>
      {(order) => (
        <>
          <PageHeader
            title={`Đơn hàng ${order.order_code}`}
            subtitle={`Đặt ngày ${formatDateTime(order.created_at)}`}
            extra={
              <Flex gap={8} wrap>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/orders')}>
                  Về danh sách
                </Button>
                <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
                  In hóa đơn
                </Button>
              </Flex>
            }
          />

          <Flex vertical gap={16}>
            <Card>
              <Flex vertical gap={20}>
                <Flex justify="space-between" align="center" wrap gap={12}>
                  <OrderStatusTag status={order.status} />
                  <OrderActions order={order} />
                </Flex>
                <OrderTimeline order={order} />
              </Flex>
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} lg={14}>
                <Card title="Sản phẩm trong đơn">
                  <OrderItemsTable details={order.details} />
                  <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
                    Giá hiển thị là giá tại thời điểm đặt hàng, không đổi khi giá sản phẩm thay đổi.
                  </Text>
                </Card>
              </Col>

              <Col xs={24} lg={10}>
                <Flex vertical gap={16}>
                  <Card title="Khách hàng">
                    <Descriptions
                      column={1}
                      size="small"
                      items={[
                        {
                          key: 'name',
                          label: 'Tài khoản',
                          children: order.customer ? (
                            <Link to={`/admin/customers/${order.customer.id}`}>
                              {order.customer.full_name}
                            </Link>
                          ) : (
                            '—'
                          ),
                        },
                        { key: 'email', label: 'Email', children: order.customer?.email ?? '—' },
                        { key: 'phone', label: 'Điện thoại', children: order.customer?.phone ?? '—' },
                      ]}
                    />
                  </Card>

                  <Card title="Giao hàng">
                    <Descriptions
                      column={1}
                      size="small"
                      items={[
                        { key: 'name', label: 'Người nhận', children: order.receiver_name },
                        { key: 'phone', label: 'Điện thoại', children: order.receiver_phone },
                        { key: 'address', label: 'Địa chỉ', children: order.shipping_address },
                        { key: 'note', label: 'Ghi chú', children: order.note || '—' },
                      ]}
                    />
                  </Card>

                  <Card title="Thanh toán">
                    <Descriptions
                      column={1}
                      size="small"
                      items={[
                        {
                          key: 'method',
                          label: 'Phương thức',
                          children: formatLabel(PAYMENT_METHOD_LABEL, order.payment?.method),
                        },
                        {
                          key: 'status',
                          label: 'Trạng thái',
                          children: formatLabel(PAYMENT_STATUS_LABEL, order.payment?.status),
                        },
                        {
                          key: 'paid_at',
                          label: 'Thời điểm thu',
                          children: formatDateTime(order.payment?.paid_at),
                        },
                      ]}
                    />
                  </Card>

                  <Card title="Tổng tiền">
                    <OrderSummary
                      subtotal={order.subtotal}
                      discountAmount={order.discount_amount}
                      shippingFee={order.shipping_fee}
                      totalAmount={order.total_amount}
                      promotionCode={order.promotion_code}
                    />
                  </Card>
                </Flex>
              </Col>
            </Row>
          </Flex>
        </>
      )}
    </QueryBoundary>
  );
}
