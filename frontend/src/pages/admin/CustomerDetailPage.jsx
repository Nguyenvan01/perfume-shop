import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Flex,
  Row,
  Space,
  Statistic,
  Tag,
} from 'antd';
import { ArrowLeftOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { customersApi } from '../../api/customers';
import { PageHeader, QueryBoundary, DataTable, ConfirmButton, EmptyState } from '../../components';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../utils/format';
import { USER_STATUS_LABEL, ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from '../../utils/constants';
import { useAuth } from '../../features/auth/AuthContext';

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [orderParams, setOrderParams] = useState({ page: 1, limit: 10 });
  const { notification } = App.useApp();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const customerQuery = useQuery({
    queryKey: ['customers', 'detail', id],
    queryFn: () => customersApi.detail(id),
  });

  const ordersQuery = useQuery({
    queryKey: ['customers', 'orders', id, orderParams],
    queryFn: () => customersApi.orders(id, orderParams),
  });

  const statusMutation = useMutation({
    mutationFn: (status) => customersApi.setStatus(id, status),
    onSuccess: (_data, status) => {
      notification.success({
        message: status === 'LOCKED' ? 'Đã khóa khách hàng' : 'Đã mở khóa khách hàng',
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) => notification.error({ message: error.message }),
  });

  const orderColumns = [
    {
      title: 'Mã đơn',
      dataIndex: 'order_code',
      key: 'order_code',
      render: (code, row) => <Link to={`/admin/orders/${row.id}`}>{code}</Link>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={ORDER_STATUS_COLOR[status]}>{ORDER_STATUS_LABEL[status] ?? status}</Tag>
      ),
    },
    { title: 'Số mặt hàng', dataIndex: 'item_count', key: 'item_count', align: 'right' },
    {
      title: 'Tổng tiền',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right',
      render: formatCurrency,
    },
    { title: 'Ngày đặt', dataIndex: 'created_at', key: 'created_at', render: formatDateTime },
    {
      title: 'Ngày hoàn thành',
      dataIndex: 'completed_at',
      key: 'completed_at',
      render: formatDateTime,
    },
  ];

  return (
    <QueryBoundary query={customerQuery} skeletonRows={8}>
      {(customer) => {
        const isLocked = customer.status === 'LOCKED';

        return (
          <>
            <PageHeader
              title={customer.full_name}
              subtitle={customer.email}
              extra={
                <Space>
                  <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/admin/customers')}
                  >
                    Về danh sách
                  </Button>
                  {isAdmin && (
                    <ConfirmButton
                      danger={!isLocked}
                      icon={isLocked ? <UnlockOutlined /> : <LockOutlined />}
                      title={isLocked ? 'Mở khóa khách hàng này?' : 'Khóa khách hàng này?'}
                      description={
                        isLocked
                          ? 'Khách sẽ đăng nhập lại được.'
                          : 'Khách bị đăng xuất khỏi mọi thiết bị.'
                      }
                      loading={statusMutation.isPending}
                      onConfirm={() => statusMutation.mutate(isLocked ? 'ACTIVE' : 'LOCKED')}
                    >
                      {isLocked ? 'Mở khóa' : 'Khóa tài khoản'}
                    </ConfirmButton>
                  )}
                </Space>
              }
            />

            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
              <Col xs={12} md={8}>
                <Card>
                  <Statistic
                    title="Đơn hoàn thành"
                    value={formatNumber(customer.total_orders)}
                  />
                </Card>
              </Col>
              <Col xs={12} md={8}>
                <Card>
                  <Statistic
                    title="Tổng chi tiêu"
                    value={formatCurrency(customer.total_spending)}
                  />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card>
                  <Statistic
                    title="Trạng thái"
                    valueRender={() => (
                      <Tag color={isLocked ? 'red' : 'green'}>
                        {USER_STATUS_LABEL[customer.status]}
                      </Tag>
                    )}
                  />
                </Card>
              </Col>
            </Row>

            <Flex vertical gap={16}>
              <Card title="Thông tin khách hàng">
                <Descriptions
                  column={{ xs: 1, sm: 2 }}
                  items={[
                    { key: 'name', label: 'Họ và tên', children: customer.full_name },
                    { key: 'email', label: 'Email', children: customer.email },
                    { key: 'phone', label: 'Điện thoại', children: customer.phone || '—' },
                    { key: 'address', label: 'Địa chỉ', children: customer.address || '—' },
                    {
                      key: 'created',
                      label: 'Ngày tham gia',
                      children: formatDate(customer.created_at),
                    },
                  ]}
                />
              </Card>

              <Card title="Đơn hàng theo trạng thái">
                {customer.order_status_counts.length === 0 ? (
                  <EmptyState description="Khách chưa có đơn hàng nào" />
                ) : (
                  <Flex gap={8} wrap>
                    {customer.order_status_counts.map((row) => (
                      <Tag key={row.status} color={ORDER_STATUS_COLOR[row.status]}>
                        {ORDER_STATUS_LABEL[row.status] ?? row.status}: {row.count}
                      </Tag>
                    ))}
                  </Flex>
                )}
              </Card>

              <Card title="Lịch sử đơn hàng">
                <DataTable
                  columns={orderColumns}
                  dataSource={ordersQuery.data?.items ?? []}
                  meta={ordersQuery.data?.meta}
                  loading={ordersQuery.isFetching}
                  emptyDescription="Khách chưa có đơn hàng nào"
                  onChangePage={(page, limit) => setOrderParams({ page, limit })}
                />
              </Card>
            </Flex>
          </>
        );
      }}
    </QueryBoundary>
  );
}
