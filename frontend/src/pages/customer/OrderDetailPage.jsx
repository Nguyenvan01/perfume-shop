import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Descriptions, Flex, Modal, Form, Input, Row } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ordersApi } from '../../api/orders';
import { PageHeader, QueryBoundary } from '../../components';
import { formatDateTime, formatLabel } from '../../utils/format';
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from '../../utils/constants';
import OrderStatusTag from '../../features/orders/components/OrderStatusTag';
import OrderTimeline from '../../features/orders/components/OrderTimeline';
import OrderItemsTable from '../../features/orders/components/OrderItemsTable';
import OrderSummary from '../../features/orders/components/OrderSummary';

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [form] = Form.useForm();
  const { notification } = App.useApp();
  const queryClient = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn: () => ordersApi.detail(id),
  });

  const cancelMutation = useMutation({
    mutationFn: (reason) => ordersApi.cancel(id, reason),
    onSuccess: () => {
      notification.success({
        message: 'Đã hủy đơn hàng',
        description: 'Sản phẩm trong đơn đã được hoàn lại kho.',
      });
      setCancelOpen(false);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => notification.error({ message: error.message }),
  });

  return (
    <QueryBoundary query={orderQuery} skeletonRows={10}>
      {(order) => {
        // Khách chỉ hủy được khi đơn chưa được xác nhận (CLAUDE.md §7).
        const canCancel = order.status === 'PENDING';

        return (
          <>
            <PageHeader
              title={`Đơn hàng ${order.order_code}`}
              subtitle={`Đặt ngày ${formatDateTime(order.created_at)}`}
              extra={
                <Flex gap={8} wrap>
                  <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>
                    Về danh sách
                  </Button>
                  {canCancel && (
                    <Button danger onClick={() => setCancelOpen(true)}>
                      Hủy đơn
                    </Button>
                  )}
                </Flex>
              }
            />

            <Flex vertical gap={16}>
              <Card>
                <Flex justify="space-between" align="center" wrap gap={12}>
                  <OrderStatusTag status={order.status} />
                </Flex>
                <div style={{ marginTop: 20 }}>
                  <OrderTimeline order={order} />
                </div>
              </Card>

              {!canCancel && ['CONFIRMED', 'PACKING', 'SHIPPING'].includes(order.status) && (
                <Alert
                  type="info"
                  showIcon
                  message="Đơn đã được xác nhận nên không thể tự hủy"
                  description="Liên hệ shop nếu bạn cần thay đổi đơn hàng này."
                />
              )}

              <Row gutter={[16, 16]}>
                <Col xs={24} lg={14}>
                  <Card title="Sản phẩm trong đơn">
                    <OrderItemsTable details={order.details} />
                  </Card>
                </Col>

                <Col xs={24} lg={10}>
                  <Flex vertical gap={16}>
                    <Card title="Thông tin giao hàng">
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
                            label: 'Thời điểm thanh toán',
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

            <Modal
              open={cancelOpen}
              title="Hủy đơn hàng"
              okText="Xác nhận hủy"
              cancelText="Không hủy"
              okButtonProps={{ danger: true }}
              confirmLoading={cancelMutation.isPending}
              onCancel={() => setCancelOpen(false)}
              onOk={() => form.submit()}
              destroyOnHidden
            >
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message="Đơn đã hủy không thể hoàn tác"
              />
              <Form
                form={form}
                layout="vertical"
                onFinish={({ reason }) => cancelMutation.mutate(reason)}
              >
                <Form.Item
                  name="reason"
                  label="Lý do hủy"
                  rules={[
                    { required: true, message: 'Vui lòng nhập lý do' },
                    { min: 3, message: 'Lý do quá ngắn' },
                  ]}
                >
                  <Input.TextArea rows={3} placeholder="Ví dụ: Đặt nhầm dung tích" />
                </Form.Item>
              </Form>
            </Modal>
          </>
        );
      }}
    </QueryBoundary>
  );
}
