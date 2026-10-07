import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Flex, Input, Select, Space, Tag, Typography } from 'antd';
import { LockOutlined, UnlockOutlined, EyeOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { customersApi } from '../../api/customers';
import { PageHeader, DataTable, ErrorState, ConfirmButton } from '../../components';
import { formatCurrency, formatDate, formatNumber } from '../../utils/format';
import { USER_STATUS_LABEL } from '../../utils/constants';
import { useAuth } from '../../features/auth/AuthContext';

const { Text } = Typography;

export default function CustomersPage() {
  const [params, setParams] = useState({ page: 1, limit: 10, sort: 'created_at:desc' });
  const { notification } = App.useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const customersQuery = useQuery({
    queryKey: ['customers', params],
    queryFn: () => customersApi.list(params),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => customersApi.setStatus(id, status),
    onSuccess: (_data, variables) => {
      notification.success({
        message: variables.status === 'LOCKED' ? 'Đã khóa khách hàng' : 'Đã mở khóa khách hàng',
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) => notification.error({ message: error.message }),
  });

  const setFilter = (patch) => setParams((prev) => ({ ...prev, ...patch, page: 1 }));

  const columns = [
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_value, row) => (
        <Flex vertical>
          <Link to={`/admin/customers/${row.id}`}>
            <strong>{row.full_name}</strong>
          </Link>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.email}
          </Text>
        </Flex>
      ),
    },
    { title: 'Điện thoại', dataIndex: 'phone', key: 'phone', render: (value) => value || '—' },
    {
      title: 'Địa chỉ',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
      render: (value) => value || '—',
    },
    {
      title: 'Số đơn hoàn thành',
      dataIndex: 'total_orders',
      key: 'total_orders',
      align: 'right',
      sorter: true,
      render: formatNumber,
    },
    {
      title: 'Tổng chi tiêu',
      dataIndex: 'total_spending',
      key: 'total_spending',
      align: 'right',
      sorter: true,
      render: (value) => <Text strong>{formatCurrency(value)}</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'ACTIVE' ? 'green' : 'red'}>{USER_STATUS_LABEL[status]}</Tag>
      ),
    },
    { title: 'Ngày tham gia', dataIndex: 'created_at', key: 'created_at', render: formatDate },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      render: (_value, row) => {
        const isLocked = row.status === 'LOCKED';
        return (
          <Space size={4}>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/admin/customers/${row.id}`)}
            >
              Xem
            </Button>
            {/* Khóa khách chỉ ADMIN — STAFF không thấy nút, backend cũng trả 403. */}
            {isAdmin && (
              <ConfirmButton
                size="small"
                danger={!isLocked}
                icon={isLocked ? <UnlockOutlined /> : <LockOutlined />}
                title={isLocked ? 'Mở khóa khách hàng này?' : 'Khóa khách hàng này?'}
                description={
                  isLocked
                    ? 'Khách sẽ đăng nhập lại được.'
                    : 'Khách bị đăng xuất khỏi mọi thiết bị và không đăng nhập được.'
                }
                loading={statusMutation.isPending}
                onConfirm={() =>
                  statusMutation.mutate({ id: row.id, status: isLocked ? 'ACTIVE' : 'LOCKED' })
                }
              >
                {isLocked ? 'Mở khóa' : 'Khóa'}
              </ConfirmButton>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader title="Quản lý khách hàng" subtitle="Hồ sơ, lịch sử mua và trạng thái tài khoản" />

      <Flex gap={12} wrap style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Tìm theo tên, email, số điện thoại"
          allowClear
          style={{ maxWidth: 300 }}
          onSearch={(value) => setFilter({ q: value })}
        />
        <Select
          placeholder="Trạng thái"
          allowClear
          style={{ width: 160 }}
          options={Object.entries(USER_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(value) => setFilter({ status: value })}
        />
        <Select
          value={params.sort}
          style={{ width: 220 }}
          options={[
            { value: 'created_at:desc', label: 'Mới tham gia nhất' },
            { value: 'total_spending:desc', label: 'Chi tiêu nhiều nhất' },
            { value: 'total_orders:desc', label: 'Nhiều đơn nhất' },
          ]}
          onChange={(value) => setFilter({ sort: value })}
        />
      </Flex>

      {customersQuery.isError ? (
        <ErrorState error={customersQuery.error} onRetry={customersQuery.refetch} />
      ) : (
        <DataTable
          columns={columns}
          dataSource={customersQuery.data?.items ?? []}
          meta={customersQuery.data?.meta}
          loading={customersQuery.isFetching}
          emptyDescription="Chưa có khách hàng nào"
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
