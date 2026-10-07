import { Card, Flex, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { formatCurrency, formatLabel } from '../../../utils/format';
import { GENDER_LABEL, CONCENTRATION_LABEL } from '../../../utils/constants';
import { primaryImageUrl } from '../../../utils/imageUrl';

const { Text } = Typography;

/** Card sản phẩm cho trang khách — dùng ở Home, danh sách và tìm kiếm. */
export default function ProductCard({ product }) {
  const imageUrl = primaryImageUrl(product);
  const range = product.price_range;
  const outOfStock = product.total_stock === 0;

  // Có variant nào đang giảm giá thì gắn nhãn.
  const hasDiscount = (product.variants ?? []).some((variant) => variant.sale_price != null);

  return (
    <Link to={`/products/${product.slug}`}>
      <Card
        hoverable
        styles={{ body: { padding: 12 } }}
        cover={
          <div style={{ position: 'relative', aspectRatio: '1 / 1', overflow: 'hidden' }}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={product.name}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Flex
                align="center"
                justify="center"
                style={{ width: '100%', height: '100%', background: '#f0f0f0' }}
              >
                <Text type="secondary">Chưa có ảnh</Text>
              </Flex>
            )}

            <Flex gap={4} style={{ position: 'absolute', top: 8, left: 8 }}>
              {hasDiscount && <Tag color="red">Giảm giá</Tag>}
              {outOfStock && <Tag color="default">Hết hàng</Tag>}
            </Flex>
          </div>
        }
      >
        <Flex vertical gap={4}>
          <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase' }}>
            {product.brand?.name}
          </Text>

          <Text strong ellipsis={{ tooltip: product.name }}>
            {product.name}
          </Text>

          <Text type="secondary" style={{ fontSize: 12 }}>
            {formatLabel(CONCENTRATION_LABEL, product.concentration)} ·{' '}
            {formatLabel(GENDER_LABEL, product.gender)} · {product.variant_count} dung tích
          </Text>

          <Text strong style={{ color: '#8c5a3b' }}>
            {!range
              ? 'Chưa có giá'
              : range.min === range.max
                ? formatCurrency(range.min)
                : `${formatCurrency(range.min)} – ${formatCurrency(range.max)}`}
          </Text>
        </Flex>
      </Card>
    </Link>
  );
}
