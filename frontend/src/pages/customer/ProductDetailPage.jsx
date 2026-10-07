import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  App,
  Breadcrumb,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Flex,
  Image,
  InputNumber,
  Radio,
  Row,
  Tag,
  Typography,
} from 'antd';
import { ShoppingCartOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { productsApi } from '../../api/catalog';
import { QueryBoundary } from '../../components';
import { formatCurrency, formatLabel, formatNumber } from '../../utils/format';
import { GENDER_LABEL, CONCENTRATION_LABEL } from '../../utils/constants';
import { resolveImageUrl } from '../../utils/imageUrl';
import { useAuth } from '../../features/auth/AuthContext';
import { useCart } from '../../features/cart/useCart';
import ProductReviews from '../../features/reviews/components/ProductReviews';

const { Title, Text, Paragraph } = Typography;

export default function ProductDetailPage() {
  const { slug } = useParams();
  const { isAuthenticated, isCustomer } = useAuth();
  const { notification } = App.useApp();
  const { addItem } = useCart();
  const navigate = useNavigate();

  const productQuery = useQuery({
    queryKey: ['products', 'detail', slug],
    queryFn: () => productsApi.detail(slug),
  });

  return (
    <QueryBoundary query={productQuery} skeletonRows={10}>
      {(product) => (
        <ProductDetailContent
          product={product}
          isAuthenticated={isAuthenticated}
          isCustomer={isCustomer}
          notification={notification}
          addItem={addItem}
          navigate={navigate}
        />
      )}
    </QueryBoundary>
  );
}

function ProductDetailContent({
  product,
  isAuthenticated,
  isCustomer,
  notification,
  addItem,
  navigate,
}) {
  // useMemo: nếu không, mỗi render tạo array mới làm useEffect dưới chạy lại vô ích.
  const variants = useMemo(() => product.variants ?? [], [product.variants]);

  // Mặc định chọn variant còn hàng đầu tiên; nếu hết hàng cả thì chọn cái đầu.
  const [selectedId, setSelectedId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(null);

  useEffect(() => {
    const firstInStock = variants.find((variant) => variant.stock_quantity > 0);
    setSelectedId((firstInStock ?? variants[0])?.id ?? null);
    setQuantity(1);
  }, [variants]);

  const selected = variants.find((variant) => variant.id === selectedId) ?? null;
  const images = product.images ?? [];
  const mainImage = activeImage ?? images.find((image) => image.is_primary) ?? images[0];

  const effectivePrice = selected
    ? Number(selected.sale_price ?? selected.price)
    : (product.price_range?.min ?? 0);
  const hasDiscount = selected?.sale_price != null;
  const outOfStock = !selected || selected.stock_quantity === 0;

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      // Giữ lại trang hiện tại để sau khi đăng nhập quay về đúng sản phẩm.
      navigate('/login', { state: { from: `/products/${product.slug}` } });
      return;
    }
    if (!isCustomer) {
      notification.warning({ message: 'Chỉ tài khoản khách hàng mới mua được hàng' });
      return;
    }
    addItem.mutate({ variantId: selected.id, quantity });
  };

  return (
    <>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/">Trang chủ</Link> },
          { title: <Link to="/products">Nước hoa</Link> },
          { title: product.name },
        ]}
      />

      <Row gutter={[32, 24]}>
        <Col xs={24} md={10}>
          <Flex vertical gap={12}>
            {mainImage ? (
              <Image
                src={resolveImageUrl(mainImage.image_url)}
                alt={product.name}
                style={{ borderRadius: 8, width: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Flex
                align="center"
                justify="center"
                style={{ aspectRatio: '1 / 1', background: '#f0f0f0', borderRadius: 8 }}
              >
                <Text type="secondary">Chưa có ảnh</Text>
              </Flex>
            )}

            {images.length > 1 && (
              <Flex gap={8} wrap>
                {images.map((image) => (
                  <img
                    key={image.id}
                    src={resolveImageUrl(image.image_url)}
                    alt={`${product.name} - ảnh ${image.id}`}
                    onClick={() => setActiveImage(image)}
                    style={{
                      width: 64,
                      height: 64,
                      objectFit: 'cover',
                      borderRadius: 6,
                      cursor: 'pointer',
                      border:
                        mainImage?.id === image.id ? '2px solid #8c5a3b' : '1px solid #e8e8e8',
                    }}
                  />
                ))}
              </Flex>
            )}
          </Flex>
        </Col>

        <Col xs={24} md={14}>
          <Flex vertical gap={12}>
            <Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              {product.brand?.name}
            </Text>

            <Title level={2} style={{ margin: 0 }}>
              {product.name}
            </Title>

            <Flex gap={8} wrap>
              <Tag>{formatLabel(CONCENTRATION_LABEL, product.concentration)}</Tag>
              <Tag>{formatLabel(GENDER_LABEL, product.gender)}</Tag>
              {product.fragrance_family && <Tag color="blue">{product.fragrance_family}</Tag>}
              {product.origin && <Tag>Xuất xứ: {product.origin}</Tag>}
            </Flex>

            <Flex align="baseline" gap={12}>
              <Title level={3} style={{ margin: 0, color: '#8c5a3b' }}>
                {formatCurrency(effectivePrice)}
              </Title>
              {hasDiscount && (
                <>
                  <Text delete type="secondary">
                    {formatCurrency(selected.price)}
                  </Text>
                  <Tag color="red">Giảm giá</Tag>
                </>
              )}
            </Flex>

            <Divider style={{ margin: '8px 0' }} />

            <div>
              <Text strong>Dung tích</Text>
              {variants.length === 0 ? (
                <Paragraph type="secondary" style={{ marginTop: 8 }}>
                  Sản phẩm chưa có dung tích nào được mở bán.
                </Paragraph>
              ) : (
                <Radio.Group
                  value={selectedId}
                  onChange={(event) => {
                    setSelectedId(event.target.value);
                    setQuantity(1);
                  }}
                  style={{ marginTop: 8, display: 'block' }}
                >
                  <Flex gap={8} wrap>
                    {variants.map((variant) => (
                      <Radio.Button
                        key={variant.id}
                        value={variant.id}
                        disabled={variant.stock_quantity === 0}
                      >
                        {variant.volume_ml} ml
                        {variant.stock_quantity === 0 && ' (hết)'}
                      </Radio.Button>
                    ))}
                  </Flex>
                </Radio.Group>
              )}
            </div>

            {selected && (
              <Text type="secondary">
                SKU <code>{selected.sku}</code> ·{' '}
                {selected.stock_quantity > 0
                  ? `còn ${formatNumber(selected.stock_quantity)} sản phẩm`
                  : 'tạm hết hàng'}
              </Text>
            )}

            <Flex gap={12} align="center" wrap>
              <InputNumber
                min={1}
                max={selected?.stock_quantity || 1}
                value={quantity}
                disabled={outOfStock}
                onChange={(value) => setQuantity(value ?? 1)}
              />
              <Button
                type="primary"
                size="large"
                icon={<ShoppingCartOutlined />}
                disabled={outOfStock}
                loading={addItem.isPending}
                onClick={handleAddToCart}
              >
                {outOfStock ? 'Hết hàng' : 'Thêm vào giỏ'}
              </Button>
              {!isAuthenticated && (
                <Text type="secondary">
                  <Link to="/login">Đăng nhập</Link> để mua hàng
                </Text>
              )}
              {isCustomer && (
                <Link to="/cart">
                  <Button size="large">Xem giỏ hàng</Button>
                </Link>
              )}
            </Flex>

            {/* Số lượng tối đa theo tồn kho — backend kiểm tra lại khi thêm vào giỏ. */}
            {selected && selected.stock_quantity > 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Mỗi lần đặt tối đa {formatNumber(selected.stock_quantity)} sản phẩm theo tồn kho
                hiện có.
              </Text>
            )}
          </Flex>
        </Col>
      </Row>

      <Card title="Thông tin sản phẩm" style={{ marginTop: 32 }}>
        <Paragraph>{product.description || 'Chưa có mô tả cho sản phẩm này.'}</Paragraph>

        <Descriptions
          column={{ xs: 1, sm: 2 }}
          items={[
            { key: 'brand', label: 'Thương hiệu', children: product.brand?.name },
            { key: 'category', label: 'Danh mục', children: product.category?.name },
            {
              key: 'concentration',
              label: 'Nồng độ',
              children: formatLabel(CONCENTRATION_LABEL, product.concentration),
            },
            {
              key: 'gender',
              label: 'Giới tính',
              children: formatLabel(GENDER_LABEL, product.gender),
            },
            { key: 'origin', label: 'Xuất xứ', children: product.origin || '—' },
            {
              key: 'family',
              label: 'Nhóm hương',
              children: product.fragrance_family || '—',
            },
          ]}
        />
      </Card>

      <ProductReviews productId={product.id} />
    </>
  );
}
