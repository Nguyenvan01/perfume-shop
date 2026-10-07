import { Col, Pagination, Row, Flex } from 'antd';
import { LoadingState, EmptyState, ErrorState } from '../../../components';
import ProductCard from './ProductCard';

/** Lưới sản phẩm + phân trang, đủ loading / empty / error state. */
export default function ProductGrid({ query, onChangePage, emptyDescription }) {
  if (query.isPending) return <LoadingState tip="Đang tải sản phẩm..." />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const items = query.data?.items ?? [];
  const meta = query.data?.meta;

  if (items.length === 0) {
    return <EmptyState description={emptyDescription ?? 'Không tìm thấy sản phẩm phù hợp'} />;
  }

  return (
    <Flex vertical gap={24}>
      <Row gutter={[16, 16]}>
        {items.map((product) => (
          <Col key={product.id} xs={12} sm={12} md={8} lg={6}>
            <ProductCard product={product} />
          </Col>
        ))}
      </Row>

      {meta && meta.total > meta.limit && (
        <Flex justify="center">
          <Pagination
            current={meta.page}
            pageSize={meta.limit}
            total={meta.total}
            showSizeChanger={false}
            onChange={onChangePage}
          />
        </Flex>
      )}
    </Flex>
  );
}
