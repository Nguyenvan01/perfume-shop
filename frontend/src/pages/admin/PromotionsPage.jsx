import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Flex, Input, Progress, Select, Space, Switch, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { promotionsApi } from '../../api/promotions';
import { PageHeader, DataTable, ErrorState, ConfirmButton } from '../../components';
import { formatCurrency, formatDate, formatLabel } from '../../utils/format';
import { DISCOUNT_TYPE_LABEL, STATUS_LABEL } from '../../utils/constants';
import { useAuth } from '../../features/auth/AuthContext';
import PromotionFormModal from '../../features/promotions/components/PromotionFormModal';
import PromotionStateTag from '../../features/promotions/components/PromotionStateTag';

const { Text } = Typography;

export default function PromotionsPage() {
  const [params, setParams] = useState({ page: 1, limit: 10, sort: 'created_at:desc' });
  const [modal, setModal] = useState({ open: false, promotion: null });
  const { notification } = App.useApp();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const promotionsQuery = useQuery({
    queryKey: ['promotions', params],
    queryFn: () => promotionsApi.list(params),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['promotions'] });
  const onError = (error) => notification.error({ message: error.message });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => promotionsApi.setStatus(id, status),
    onSuccess: (_data, variables) => {
      notification.success({
        message: variables.status === 'ACTIVE' ? 'Đã bật khuyến mãi' : 'Đã tắt khuyến mãi',
      });
      invalidate();
    },
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => promotionsApi.remove(id),
    onSuccess: () => {
      notification.success({ message: 'Đã xóa khuyến mãi' });
      invalidate();
    },
    onError,
  });

  const setFilter = (patch) => setParams((prev) => ({ ...prev, ...patch, page: 1 }));

  const columns = [
    {
      title: 'Mã',
      dataIndex: 'code',
      key: 'code',
      render: (code, row) => (
        <Flex vertical>
          <Text strong>
            <code>{code}</code>
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.name}
          </Text>
        </Flex>
      ),
    },
    {
      title: 'Giảm giá',
      key: 'discount',
      render: (_value, row) => (
        <Flex vertical>
          <Text>
            {row.discount_type === 'PERCENTAGE'
              ? `${Number(row.discount_value)}%`
              : formatCurrency(row.discount_value)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {formatLabel(DISCOUNT_TYPE_LABEL, row.discount_type)}
            {row.max_discount != null && ` · tối đa ${formatCurrency(row.max_discount)}`}
          </Text>
        </Flex>
      ),
    },
    {
      title: 'Điều kiện',
      key: 'conditions',
      render: (_value, row) => (
        <Flex vertical>
          <Text style={{ fontSize: 12 }}>
            Đơn từ {formatCurrency(row.minimum_order_value)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.per_customer_limit} lượt/khách
          </Text>
        </Flex>
      ),
    },
    {
      title: 'Hiệu lực',
      key: 'period',
      render: (_value, row) => (
        <Text style={{ fontSize: 12 }}>
          {formatDate(row.start_date)} → {formatDate(row.end_date)}
        </Text>
      ),
    },
    {
      title: 'Lượt dùng',
      key: 'usage',
      width: 140,
      render: (_value, row) =>
        row.usage_limit == null ? (
          <Text type="secondary">{row.used_count} / không giới hạn</Text>
        ) : (
          <Flex vertical gap={2}>
            <Text style={{ fontSize: 12 }}>
              {row.used_count} / {row.usage_limit}
            </Text>
            <Progress
              percent={Math.round((row.used_count / row.usage_limit) * 100)}
              size="small"
              showInfo={false}
            />
          </Flex>
        ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'effective_state',
      key: 'effective_state',
      render: (state) => <PromotionStateTag state={state} />,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      render: (_value, row) =>
        isAdmin ? (
          <Space size={4} wrap>
            <Switch
              size="small"
              checked={row.status === 'ACTIVE'}
              loading={statusMutation.isPending}
              onChange={(checked) =>
                statusMutation.mutate({ id: row.id, status: checked ? 'ACTIVE' : 'INACTIVE' })
              }
            />
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => setModal({ open: true, promotion: row })}
            >
              Sửa
            </Button>
            <ConfirmButton
              size="small"
              danger
              icon={<DeleteOutlined />}
              // Mã đã có đơn dùng thì backend trả 409 — tắt thay vì xóa.
              disabled={row.used_count > 0}
              title="Xóa khuyến mãi này?"
              description="Chỉ xóa được mã chưa có đơn nào dùng. Mã đã dùng thì hãy tắt."
              loading={deleteMutation.isPending}
              onConfirm={() => deleteMutation.mutate(row.id)}
            >
              Xóa
            </ConfirmButton>
          </Space>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Chỉ quản trị viên
          </Text>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Quản lý khuyến mãi"
        subtitle="Mã giảm giá khách nhập ở giỏ hàng. Hệ thống kiểm tra lại mọi điều kiện khi đặt hàng."
        extra={
          isAdmin && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModal({ open: true, promotion: null })}
            >
              Thêm khuyến mãi
            </Button>
          )
        }
      />

      <Flex gap={12} wrap align="center" style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Tìm theo mã hoặc tên"
          allowClear
          style={{ maxWidth: 280 }}
          onSearch={(value) => setFilter({ q: value })}
        />
        <Select
          placeholder="Trạng thái"
          allowClear
          style={{ width: 180 }}
          options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(status) => setFilter({ status })}
        />
        <Flex gap={8} align="center">
          <Text>Chỉ mã đang chạy</Text>
          <Switch
            checked={params.active_only === 'true'}
            onChange={(checked) => setFilter({ active_only: checked ? 'true' : undefined })}
          />
        </Flex>
      </Flex>

      {promotionsQuery.isError ? (
        <ErrorState error={promotionsQuery.error} onRetry={promotionsQuery.refetch} />
      ) : (
        <DataTable
          columns={columns}
          dataSource={promotionsQuery.data?.items ?? []}
          meta={promotionsQuery.data?.meta}
          loading={promotionsQuery.isFetching}
          emptyDescription="Chưa có chương trình khuyến mãi nào"
          onChangePage={(page, limit) => setParams((prev) => ({ ...prev, page, limit }))}
        />
      )}

      <PromotionFormModal
        open={modal.open}
        promotion={modal.promotion}
        onClose={() => setModal({ open: false, promotion: null })}
        onSuccess={invalidate}
      />
    </>
  );
}
