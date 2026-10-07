import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Image,
  Input,
  InputNumber,
  Row,
  Table,
  Typography,
} from 'antd';
import { DeleteOutlined, ShoppingOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { cartApi } from '../../api/cart';
import { PageHeader, LoadingState, ErrorState, ConfirmButton } from '../../components';
import { formatCurrency } from '../../utils/format';
import { resolveImageUrl } from '../../utils/imageUrl';
import { useCart } from '../../features/cart/useCart';
import OrderSummary from '../../features/orders/components/OrderSummary';

const { Text, Title } = Typography;

export default function CartPage() {
  const { cartQuery, cart, updateItem, removeItem, clearCart } = useCart();
  const [promotionCode, setPromotionCode] = useState('');
  const [appliedCode, setAppliedCode] = useState(null);
  const navigate = useNavigate();

  // Preview tính tiền ở backend, kể cả phần giảm giá — frontend không tự tính.
  const previewQuery = useQuery({
    queryKey: ['cart', 'preview', appliedCode],
    queryFn: () => cartApi.preview({ promotion_code: appliedCode ?? undefined }),
    enabled: (cart?.items?.length ?? 0) > 0,
  });

  if (cartQuery.isPending) return <LoadingState tip="Đang tải giỏ hàng..." />;
  if (cartQuery.isError) return <ErrorState error={cartQuery.error} onRetry={cartQuery.refetch} />;

  const items = cart?.items ?? [];
  const preview = previewQuery.data;

  if (items.length === 0) {
    return (
      <>
        <PageHeader title="Giỏ hàng" />
        <Card>
          <Empty description="Giỏ hàng của bạn đang trống">
            <Link to="/products">
              <Button type="primary" icon={<ShoppingOutlined />}>
                Xem sản phẩm
              </Button>
            </Link>
          </Empty>
        </Card>
      </>
    );
  }

  const columns = [
    {
      title: 'Sản phẩm',
      key: 'product',
      render: (_value, row) => (
        <Flex gap={12}>
          <Image
            src={resolveImageUrl(row.image_url)}
            alt={row.product_name}
            width={64}
            height={64}
            style={{ objectFit: 'cover', borderRadius: 6 }}
            fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
          />
          <Flex vertical>
            <Link to={`/products/${row.product_slug}`}>
              <Text strong>{row.product_name}</Text>
            </Link>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <code>{row.sku}</code> · {row.volume_ml}ml
            </Text>
            {row.issues.length > 0 && (
              <Text type="danger" style={{ fontSize: 12 }}>
                {row.issues.join('; ')}
              </Text>
            )}
          </Flex>
        </Flex>
      ),
    },
    {
      title: 'Đơn giá',
      key: 'unit_price',
      align: 'right',
      render: (_value, row) => (
        <Flex vertical align="flex-end">
          <Text strong>{formatCurrency(row.unit_price)}</Text>
          {Number(row.list_price) > Number(row.unit_price) && (
            <Text delete type="secondary" style={{ fontSize: 12 }}>
              {formatCurrency(row.list_price)}
            </Text>
          )}
        </Flex>
      ),
    },
    {
      title: 'Số lượng',
      key: 'quantity',
      align: 'center',
      render: (_value, row) => (
        <Flex vertical align="center" gap={2}>
          <InputNumber
            min={1}
            // Giới hạn theo tồn kho; backend kiểm tra lại nên đây chỉ là UX.
            max={Math.max(row.stock_quantity, 1)}
            value={row.quantity}
            disabled={row.stock_quantity === 0 || updateItem.isPending}
            onChange={(quantity) => {
              if (quantity && quantity !== row.quantity) {
                updateItem.mutate({ itemId: row.id, quantity });
              }
            }}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>
            còn {row.stock_quantity}
          </Text>
        </Flex>
      ),
    },
    {
      title: 'Thành tiền',
      dataIndex: 'line_total',
      key: 'line_total',
      align: 'right',
      render: (value) => <Text strong>{formatCurrency(value)}</Text>,
    },
    {
      title: '',
      key: 'actions',
      render: (_value, row) => (
        <ConfirmButton
          type="text"
          danger
          icon={<DeleteOutlined />}
          title="Xóa sản phẩm này khỏi giỏ?"
          loading={removeItem.isPending}
          onConfirm={() => removeItem.mutate(row.id)}
        />
      ),
    },
  ];

  const blockingIssues = items.some((item) => item.issues.length > 0);

  return (
    <>
      <PageHeader
        title="Giỏ hàng"
        subtitle={`${items.length} sản phẩm`}
        extra={
          <ConfirmButton
            danger
            title="Xóa toàn bộ giỏ hàng?"
            loading={clearCart.isPending}
            onConfirm={() => clearCart.mutate()}
          >
            Xóa tất cả
          </ConfirmButton>
        }
      />

      {blockingIssues && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Một số sản phẩm trong giỏ cần xử lý trước khi đặt hàng"
          description="Giảm số lượng về mức còn hàng hoặc xóa sản phẩm không còn được bán."
        />
      )}

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={items}
            pagination={false}
            scroll={{ x: 'max-content' }}
            loading={updateItem.isPending}
          />
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Tóm tắt đơn hàng">
            <Flex vertical gap={16}>
              <Flex gap={8}>
                <Input
                  placeholder="Mã giảm giá"
                  value={promotionCode}
                  onChange={(event) => setPromotionCode(event.target.value.toUpperCase())}
                  onPressEnter={() => setAppliedCode(promotionCode || null)}
                />
                <Button
                  onClick={() => setAppliedCode(promotionCode || null)}
                  loading={previewQuery.isFetching}
                >
                  Áp dụng
                </Button>
              </Flex>

              {preview?.promotion_error && (
                <Alert type="error" showIcon message={preview.promotion_error} />
              )}
              {preview?.promotion && (
                <Alert
                  type="success"
                  showIcon
                  message={`Đã áp dụng ${preview.promotion.code}`}
                  description={preview.promotion.name}
                />
              )}

              {previewQuery.isPending ? (
                <LoadingState rows={3} />
              ) : (
                <OrderSummary
                  subtotal={preview?.subtotal ?? cart.subtotal}
                  discountAmount={preview?.discount_amount ?? 0}
                  shippingFee={preview?.shipping_fee ?? 0}
                  totalAmount={preview?.total_amount ?? cart.subtotal}
                  promotionCode={preview?.promotion?.code}
                />
              )}

              <Button
                type="primary"
                size="large"
                block
                disabled={blockingIssues}
                onClick={() =>
                  navigate('/checkout', { state: { promotionCode: appliedCode ?? undefined } })
                }
              >
                Tiến hành đặt hàng
              </Button>

              <Link to="/products">
                <Button block>Tiếp tục mua sắm</Button>
              </Link>
            </Flex>
          </Card>
        </Col>
      </Row>

      <Title level={5} style={{ marginTop: 24, color: '#888', fontWeight: 400 }}>
        Số lượng mua không vượt quá tồn kho. Hệ thống kiểm tra lại tồn kho khi bạn đặt hàng.
      </Title>
    </>
  );
}
