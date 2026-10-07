import { useQuery } from '@tanstack/react-query';
import { Table, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { inventoryApi } from '../../../api/inventory';
import { EmptyState, ErrorState } from '../../../components';
import StockTag from './StockTag';

const { Text } = Typography;

/** Bảng hàng sắp hết — dùng ở trang Tồn kho và tái sử dụng ở Dashboard (W6). */
export default function LowStockTable({ limit = 10, threshold = 5 }) {
  const query = useQuery({
    queryKey: ['inventory', 'low-stock', limit],
    queryFn: () => inventoryApi.lowStock({ limit }),
  });

  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const columns = [
    {
      title: 'Sản phẩm',
      key: 'product',
      render: (_value, row) => (
        <>
          <Link to={`/admin/products/${row.product_id}`}>{row.product_name}</Link>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            <code>{row.sku}</code> · {row.volume_ml}ml
          </Text>
        </>
      ),
    },
    { title: 'Thương hiệu', dataIndex: 'brand_name', key: 'brand_name' },
    {
      title: 'Tồn kho',
      dataIndex: 'stock_quantity',
      key: 'stock_quantity',
      align: 'right',
      render: (quantity) => <StockTag quantity={quantity} threshold={threshold} />,
    },
  ];

  return (
    <Table
      size="small"
      rowKey="variant_id"
      columns={columns}
      dataSource={query.data?.items ?? []}
      loading={query.isFetching}
      pagination={false}
      locale={{ emptyText: <EmptyState description="Không có hàng nào sắp hết" /> }}
    />
  );
}
