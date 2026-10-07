import { useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Flex, Row, Typography } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { productsApi, brandsApi } from '../../api/catalog';
import { LoadingState, ErrorState, EmptyState } from '../../components';
import { resolveImageUrl } from '../../utils/imageUrl';
import ProductCard from '../../features/products/components/ProductCard';

const { Title, Text, Paragraph } = Typography;

function ProductSection({ title, subtitle, query, moreLink }) {
  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-end" wrap gap={8}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            {title}
          </Title>
          {subtitle && <Text type="secondary">{subtitle}</Text>}
        </div>
        {moreLink && (
          <Link to={moreLink}>
            <Button type="link" icon={<ArrowRightOutlined />} iconPosition="end">
              Xem tất cả
            </Button>
          </Link>
        )}
      </Flex>

      {query.isPending && <LoadingState tip="Đang tải sản phẩm..." />}
      {query.isError && <ErrorState error={query.error} onRetry={query.refetch} />}
      {query.isSuccess &&
        (query.data.items.length === 0 ? (
          <EmptyState description="Chưa có sản phẩm nào" />
        ) : (
          <Row gutter={[16, 16]}>
            {query.data.items.map((product) => (
              <Col key={product.id} xs={12} sm={12} md={8} lg={6}>
                <ProductCard product={product} />
              </Col>
            ))}
          </Row>
        ))}
    </Flex>
  );
}

export default function HomePage() {
  const newestQuery = useQuery({
    queryKey: ['products', 'home', 'newest'],
    queryFn: () => productsApi.list({ limit: 8, sort: 'created_at:desc' }),
  });

  const inStockQuery = useQuery({
    queryKey: ['products', 'home', 'in-stock'],
    queryFn: () => productsApi.list({ limit: 4, in_stock: 'true', sort: 'price:asc' }),
  });

  const brandsQuery = useQuery({
    queryKey: ['brands', 'home'],
    queryFn: () => brandsApi.list({ limit: 12, status: 'ACTIVE' }),
  });

  return (
    <Flex vertical gap={40}>
      <Card
        styles={{ body: { padding: '48px 32px' } }}
        style={{ background: 'linear-gradient(135deg, #2d2d3a 0%, #8c5a3b 100%)', border: 'none' }}
      >
        <Flex vertical gap={16} style={{ maxWidth: 620 }}>
          <Title level={1} style={{ color: '#fff', margin: 0 }}>
            Nước hoa chính hãng
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, margin: 0 }}>
            Chọn đúng dung tích bạn cần — từ chai mini 30ml dùng thử đến 200ml dùng lâu dài. Mỗi
            dung tích có mã SKU và tồn kho riêng.
          </Paragraph>
          <Flex gap={12} wrap>
            <Link to="/products">
              <Button type="primary" size="large">
                Xem sản phẩm
              </Button>
            </Link>
            <Link to="/products?in_stock=true">
              <Button size="large" ghost>
                Hàng có sẵn
              </Button>
            </Link>
          </Flex>
        </Flex>
      </Card>

      {brandsQuery.isSuccess && brandsQuery.data.items.length > 0 && (
        <Flex vertical gap={16}>
          <Title level={4} style={{ margin: 0 }}>
            Thương hiệu
          </Title>
          <Flex gap={12} wrap>
            {brandsQuery.data.items.map((brand) => (
              <Link key={brand.id} to={`/products?brand_id=${brand.id}`}>
                <Card size="small" hoverable style={{ minWidth: 120, textAlign: 'center' }}>
                  <Flex vertical align="center" gap={8}>
                    {brand.logo_url ? (
                      <img
                        src={resolveImageUrl(brand.logo_url)}
                        alt={brand.name}
                        style={{ height: 32, objectFit: 'contain' }}
                      />
                    ) : null}
                    <Text strong>{brand.name}</Text>
                  </Flex>
                </Card>
              </Link>
            ))}
          </Flex>
        </Flex>
      )}

      <ProductSection
        title="Sản phẩm mới"
        subtitle="Vừa được thêm vào danh mục"
        query={newestQuery}
        moreLink="/products"
      />

      <ProductSection
        title="Hàng có sẵn, giá tốt"
        subtitle="Còn tồn kho, giao được ngay"
        query={inStockQuery}
        moreLink="/products?in_stock=true"
      />
    </Flex>
  );
}
