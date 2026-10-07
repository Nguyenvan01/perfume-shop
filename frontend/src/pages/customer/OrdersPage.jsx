import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Flex, Select, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { ordersApi } from '../../api/orders';
import { PageHeader, DataTable, ErrorState } from '../../components';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { ORDER_STATUS_LABEL } from '../../utils/constants';
import OrderStatusTag from '../../features/orders/components/OrderStatusTag';

const { Text } = Typography;

export default function OrdersPage() {
  const [params, setParams] = useState({ page: 1, limit: 10 });

  const ordersQuery = useQuery({
    queryKey: ['orders', 'my', params],
    queryFn: () => ordersApi.myOrders(params),
  });

  const columns = [
    {
      title: 'Mã đơn',
      dataIndex: 'order_code',
      key: 'order_code',
      render: (code, row) => <Link to={`/orders/${row.id}`}>{code}</Link>,
    },
    {
      title: 'Ngày đặt',
      dataIndex: 'created_at',
      key: 'created_at',
      render: formatDateTime,
    },
    { title: 'Số mặt hàng', dataIndex: 'item_count', key: 'item_count', align: 'right' },
    {
      title: 'Tổng tiền',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right',
      render: (value) => <Text strong>{formatCurrency(value)}</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <OrderStatusTag status={status} />,
    },
    {
      title: '',
      key: 'actions',
      render: (_value, row) => (
        <Link to={`/orders/${row.id}`}>
          <Button size="small">Chi tiết</Button>
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Đơn hàng của tôi" subtitle="Theo dõi trạng thái các đơn đã đặt" />

      <Flex gap={12} style={{ marginBottom: 16 }}>
        <Select
          placeholder="Lọc theo trạng thái"
          allowClear
          style={{ width: 200 }}
          options={Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(status) => setParams((prev) => ({ ...prev, status, page: 1 }))}
        />
      </Flex>

      {ordersQuery.isError ? (
        <ErrorState error={ordersQuery.error} onRetry={ordersQuery.refetch} />
      ) : (
        <DataTable
          columns={columns}
          dataSource={ordersQuery.data?.items ?? []}
          meta={ordersQuery.data?.meta}
          loading={ordersQuery.isFetching}
          emptyDescription="Bạn chưa có đơn hàng nào"
          onChangePage={(page, limit) => setParams((prev) => ({ ...prev, page, limit }))}
        />
      )}
    </>
  );
}
