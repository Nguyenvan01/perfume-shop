import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  Radio,
  Row,
  Typography,
} from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { cartApi } from '../../api/cart';
import { ordersApi } from '../../api/orders';
import { authApi } from '../../api/auth';
import { PageHeader, LoadingState, ErrorState } from '../../components';
import { formatCurrency } from '../../utils/format';
import { PAYMENT_METHOD_LABEL } from '../../utils/constants';
import { handleMutationError } from '../../utils/formErrors';
import { CART_QUERY_KEY } from '../../features/cart/useCart';
import OrderSummary from '../../features/orders/components/OrderSummary';

const { Text } = Typography;

export default function CheckoutPage() {
  const [form] = Form.useForm();
  const location = useLocation();
  const navigate = useNavigate();
  const { notification } = App.useApp();
  const queryClient = useQueryClient();

  // Mã giảm giá được mang sang từ trang giỏ hàng.
  const [promotionCode, setPromotionCode] = useState(location.state?.promotionCode ?? null);
  const [codeInput, setCodeInput] = useState(location.state?.promotionCode ?? '');

  const previewQuery = useQuery({
    queryKey: ['cart', 'preview', promotionCode],
    queryFn: () => cartApi.preview({ promotion_code: promotionCode ?? undefined }),
  });

  const profileQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.me });

  const createOrder = useMutation({
    mutationFn: (payload) => ordersApi.create(payload),
    onSuccess: (order) => {
      notification.success({
        message: `Đặt hàng thành công — ${order.order_code}`,
        description: 'Đơn hàng đang chờ shop xác nhận.',
      });
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      navigate(`/orders/${order.id}`, { replace: true });
    },
    onError: (error) =>
      handleMutationError({
        error,
        form,
        notify: notification,
        fallback: 'Không đặt được hàng',
      }),
  });

  if (previewQuery.isPending || profileQuery.isPending) {
    return <LoadingState tip="Đang chuẩn bị đơn hàng..." />;
  }
  if (previewQuery.isError) {
    return <ErrorState error={previewQuery.error} onRetry={previewQuery.refetch} />;
  }

  const preview = previewQuery.data;
  const profile = profileQuery.data;
  const items = preview.items ?? [];
  const blockingIssues = items.some((item) => item.issues.length > 0);

  if (items.length === 0) {
    return (
      <>
        <PageHeader title="Thanh toán" />
        <Alert
          type="info"
          showIcon
          message="Giỏ hàng trống"
          description="Thêm sản phẩm vào giỏ trước khi đặt hàng."
          action={
            <Button type="primary" onClick={() => navigate('/products')}>
              Xem sản phẩm
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Thanh toán" subtitle="Kiểm tra thông tin trước khi đặt hàng" />

      {blockingIssues && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Giỏ hàng có sản phẩm không đặt được"
          description="Quay lại giỏ hàng để điều chỉnh số lượng hoặc xóa sản phẩm đã hết."
          action={
            <Button danger onClick={() => navigate('/cart')}>
              Về giỏ hàng
            </Button>
          }
        />
      )}

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card title="Thông tin giao hàng">
            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              // Điền sẵn từ hồ sơ để khách không phải nhập lại.
              initialValues={{
                receiver_name: profile.full_name ?? '',
                receiver_phone: profile.phone ?? '',
                shipping_address: profile.address ?? '',
                payment_method: 'COD',
              }}
              onFinish={(values) =>
                createOrder.mutate({
                  ...values,
                  note: values.note || undefined,
                  promotion_code: preview.promotion?.code ?? undefined,
                })
              }
            >
              <Form.Item
                name="receiver_name"
                label="Người nhận"
                rules={[
                  { required: true, message: 'Vui lòng nhập tên người nhận' },
                  { min: 2, message: 'Tên quá ngắn' },
                ]}
              >
                <Input placeholder="Nguyễn Văn A" />
              </Form.Item>

              <Form.Item
                name="receiver_phone"
                label="Số điện thoại"
                rules={[
                  { required: true, message: 'Vui lòng nhập số điện thoại' },
                  { pattern: /^0\d{8,10}$/, message: 'Số điện thoại không hợp lệ' },
                ]}
              >
                <Input placeholder="0901234567" />
              </Form.Item>

              <Form.Item
                name="shipping_address"
                label="Địa chỉ giao hàng"
                rules={[
                  { required: true, message: 'Vui lòng nhập địa chỉ' },
                  { min: 5, message: 'Địa chỉ quá ngắn' },
                ]}
              >
                <Input.TextArea rows={2} placeholder="Số nhà, đường, quận, thành phố" />
              </Form.Item>

              <Form.Item name="note" label="Ghi chú">
                <Input.TextArea rows={2} placeholder="Ghi chú cho shop (không bắt buộc)" />
              </Form.Item>

              <Form.Item
                name="payment_method"
                label="Phương thức thanh toán"
                rules={[{ required: true }]}
              >
                <Radio.Group>
                  <Flex vertical gap={8}>
                    {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                      <Radio key={value} value={value}>
                        {label}
                      </Radio>
                    ))}
                  </Flex>
                </Radio.Group>
              </Form.Item>

              <Button
                type="primary"
                size="large"
                htmlType="submit"
                block
                loading={createOrder.isPending}
                disabled={blockingIssues}
              >
                Đặt hàng — {formatCurrency(preview.total_amount)}
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Flex vertical gap={16}>
            <Card title={`Đơn hàng (${items.length} sản phẩm)`}>
              <Flex vertical gap={12}>
                {items.map((item) => (
                  <Flex key={item.id} justify="space-between" gap={12}>
                    <Flex vertical>
                      <Text>{item.product_name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.volume_ml}ml × {item.quantity}
                        {item.issues.length > 0 && (
                          <Text type="danger"> — {item.issues.join('; ')}</Text>
                        )}
                      </Text>
                    </Flex>
                    <Text strong style={{ whiteSpace: 'nowrap' }}>
                      {formatCurrency(item.line_total)}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            </Card>

            <Card title="Mã giảm giá">
              <Flex gap={8}>
                <Input
                  placeholder="Nhập mã"
                  value={codeInput}
                  onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
                  onPressEnter={() => setPromotionCode(codeInput || null)}
                />
                <Button
                  onClick={() => setPromotionCode(codeInput || null)}
                  loading={previewQuery.isFetching}
                >
                  Áp dụng
                </Button>
              </Flex>

              {preview.promotion_error && (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginTop: 12 }}
                  message={preview.promotion_error}
                />
              )}
              {preview.promotion && (
                <Alert
                  type="success"
                  showIcon
                  style={{ marginTop: 12 }}
                  message={`Đã áp dụng ${preview.promotion.code}`}
                />
              )}
            </Card>

            <Card title="Tổng tiền">
              <OrderSummary
                subtotal={preview.subtotal}
                discountAmount={preview.discount_amount}
                shippingFee={preview.shipping_fee}
                totalAmount={preview.total_amount}
                promotionCode={preview.promotion?.code}
              />
            </Card>
          </Flex>
        </Col>
      </Row>
    </>
  );
}
