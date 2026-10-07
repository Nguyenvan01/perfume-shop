import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Col, Drawer, Row, Typography } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { productsApi } from '../../api/catalog';
import { PageHeader } from '../../components';
import ProductFilters from '../../features/products/components/ProductFilters';
import ProductGrid from '../../features/products/components/ProductGrid';

const { Text } = Typography;

const INITIAL_PARAMS = { page: 1, limit: 12, sort: 'created_at:desc' };

export default function ProductsPage() {
  const [params, setParams] = useState(INITIAL_PARAMS);
  const [filterOpen, setFilterOpen] = useState(false);

  const productsQuery = useQuery({
    queryKey: ['products', 'public', params],
    queryFn: () => productsApi.list(params),
  });

  const total = productsQuery.data?.meta?.total;

  const filters = (
    <ProductFilters
      value={params}
      onChange={setParams}
      onReset={() => setParams(INITIAL_PARAMS)}
    />
  );

  return (
    <>
      <PageHeader
        title="Nước hoa"
        subtitle={total !== undefined ? `${total} sản phẩm` : 'Đang tải...'}
        extra={
          // Màn hình nhỏ: filter nằm trong drawer cho đỡ chật.
          <Button
            icon={<FilterOutlined />}
            onClick={() => setFilterOpen(true)}
            className="filter-trigger"
          >
            Lọc
          </Button>
        }
      />

      <Row gutter={24}>
        <Col xs={0} md={6}>
          {filters}
        </Col>
        <Col xs={24} md={18}>
          <ProductGrid
            query={productsQuery}
            onChangePage={(page) => setParams((prev) => ({ ...prev, page }))}
            emptyDescription="Không có sản phẩm nào khớp bộ lọc. Thử bỏ một vài điều kiện."
          />
        </Col>
      </Row>

      <Drawer
        title="Lọc sản phẩm"
        placement="left"
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        width={300}
      >
        {filters}
        <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
          {total !== undefined ? `${total} sản phẩm khớp bộ lọc` : ''}
        </Text>
      </Drawer>
    </>
  );
}
