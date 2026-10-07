import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, DatePicker, Flex, Input, Select, Typography } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { ordersApi } from '../../api/orders';
import { PageHeader, DataTable, ErrorState } from '../../components';
import { formatCurrency, formatDateTime, formatLabel } from '../../utils/format';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '../../utils/constants';
import OrderStatusTag from '../../features/orders/components/OrderStatusTag';

const { Text } = Typography;
const { RangePicker } = DatePicker;

export default function OrdersPage() {
  const [params, setParams] = useState({ page: 1, limit: 10, sort: 'created_at:desc' });
  const navigate = useNavigate();

  const ordersQuery = useQuery({
    queryKey: ['orders', 'admin', params],
    queryFn: () => ordersApi.list(params),
  });

  const setFilter = (patch) => setParams((prev) => ({ ...prev, ...patch, page: 1 }));

  const columns = [
    {
      title: 'Mã đơn',
      dataIndex: 'order_code',
      key: 'order_code',
      render: (code, row) => <Link to={`/admin/orders/${row.id}`}>{code}</Link>,
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_value, row) => (
        <Flex vertical>
          <Text>{row.customer?.full_name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.receiver_phone}
          </Text>
        </Flex>
      ),
    },
    { title: 'Số mặt hàng', dataIndex: 'item_count', key: 'item_count', align: 'right' },
    {
      title: 'Tổng tiền',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right',
      sorter: true,
      render: (value) => <Text strong>{formatCurrency(value)}</Text>,
    },
    {
      title: 'Thanh toán',
      key: 'payment',
      render: (_value, row) => formatLabel(PAYMENT_STATUS_LABEL, row.payment?.status),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <OrderStatusTag status={status} />,
    },
    {
      title: 'Ngày đặt',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: true,
      render: formatDateTime,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      render: (_value, row) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/admin/orders/${row.id}`)}
        >
          Xử lý
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Quản lý đơn hàng" subtitle="Xác nhận, cập nhật trạng thái và xử lý đơn" />

      <Flex gap={12} wrap style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Tìm theo mã đơn, tên hoặc số điện thoại"
          allowClear
          style={{ maxWidth: 320 }}
          onSearch={(value) => setFilter({ q: value })}
        />
        <Select
          placeholder="Trạng thái"
          allowClear
          style={{ width: 180 }}
          options={Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(status) => setFilter({ status })}
        />
        <RangePicker
          format="DD/MM/YYYY"
          onChange={(dates) =>
            setFilter({
              from: dates?.[0]?.startOf('day').toISOString(),
              to: dates?.[1]?.endOf('day').toISOString(),
            })
          }
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
          emptyDescription="Chưa có đơn hàng nào"
          onChangePage={(page, limit) => setParams((prev) => ({ ...prev, page, limit }))}
          onChange={(_pagination, _filters, sorter) => {
            if (sorter?.field) {
              setFilter({ sort: `${sorter.field}:${sorter.order === 'ascend' ? 'asc' : 'desc'}` });
            }
          }}
        />
      )}
    </>
  );
}
