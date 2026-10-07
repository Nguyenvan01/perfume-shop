import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Flex, Rate, Select, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { EyeInvisibleOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { reviewsApi } from '../../api/reviews';
import { PageHeader, DataTable, ErrorState, ConfirmButton } from '../../components';
import { formatDateTime } from '../../utils/format';
import { useAuth } from '../../features/auth/AuthContext';

const { Text, Paragraph } = Typography;

export default function ReviewsPage() {
  const [params, setParams] = useState({ page: 1, limit: 10 });
  const { notification } = App.useApp();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const reviewsQuery = useQuery({
    queryKey: ['reviews', 'admin', params],
    queryFn: () => reviewsApi.list(params),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['reviews'] });
  const onError = (error) => notification.error({ message: error.message });

  const visibilityMutation = useMutation({
    mutationFn: ({ id, isHidden }) => reviewsApi.setVisibility(id, isHidden),
    onSuccess: (_data, variables) => {
      notification.success({
        message: variables.isHidden ? 'Đã ẩn đánh giá' : 'Đã hiện lại đánh giá',
      });
      invalidate();
    },
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => reviewsApi.remove(id),
    onSuccess: () => {
      notification.success({ message: 'Đã xóa đánh giá' });
      invalidate();
    },
    onError,
  });

  const setFilter = (patch) => setParams((prev) => ({ ...prev, ...patch, page: 1 }));

  const columns = [
    {
      title: 'Sản phẩm',
      key: 'product',
      render: (_value, row) =>
        row.product ? (
          <Link to={`/admin/products/${row.product.id}`}>{row.product.name}</Link>
        ) : (
          '—'
        ),
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_value, row) => row.customer?.full_name ?? '—',
    },
    {
      title: 'Điểm',
      dataIndex: 'rating',
      key: 'rating',
      width: 130,
      render: (rating) => <Rate disabled value={rating} style={{ fontSize: 13 }} />,
    },
    {
      title: 'Nhận xét',
      dataIndex: 'comment',
      key: 'comment',
      render: (comment) =>
        comment ? (
          <Tooltip title={comment}>
            <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, maxWidth: 320 }}>
              {comment}
            </Paragraph>
          </Tooltip>
        ) : (
          <Text type="secondary">Không có nhận xét</Text>
        ),
    },
    {
      title: 'Hiển thị',
      dataIndex: 'is_hidden',
      key: 'is_hidden',
      render: (isHidden) =>
        isHidden ? (
          <Tag color="red" icon={<EyeInvisibleOutlined />}>
            Đang ẩn
          </Tag>
        ) : (
          <Tag color="green" icon={<EyeOutlined />}>
            Đang hiện
          </Tag>
        ),
    },
    { title: 'Ngày gửi', dataIndex: 'created_at', key: 'created_at', render: formatDateTime },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      render: (_value, row) =>
        isAdmin ? (
          <Space size={4}>
            <ConfirmButton
              size="small"
              icon={row.is_hidden ? <EyeOutlined /> : <EyeInvisibleOutlined />}
              danger={!row.is_hidden}
              title={row.is_hidden ? 'Hiện lại đánh giá này?' : 'Ẩn đánh giá này?'}
              description={
                row.is_hidden
                  ? 'Đánh giá sẽ hiện lại trên trang sản phẩm và tính vào điểm trung bình.'
                  : 'Đánh giá sẽ bị ẩn khỏi trang sản phẩm và không tính vào điểm trung bình.'
              }
              loading={visibilityMutation.isPending}
              onConfirm={() =>
                visibilityMutation.mutate({ id: row.id, isHidden: !row.is_hidden })
              }
            >
              {row.is_hidden ? 'Hiện' : 'Ẩn'}
            </ConfirmButton>
            <ConfirmButton
              size="small"
              danger
              icon={<DeleteOutlined />}
              title="Xóa đánh giá này?"
              description="Xóa hẳn khỏi hệ thống. Khách sẽ đánh giá lại được sản phẩm này."
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
        title="Quản lý đánh giá"
        subtitle="Ẩn hoặc xóa đánh giá không phù hợp. Đánh giá bị ẩn không tính vào điểm trung bình."
      />

      <Flex gap={12} wrap align="center" style={{ marginBottom: 16 }}>
        <Select
          placeholder="Lọc theo số sao"
          allowClear
          style={{ width: 160 }}
          options={[5, 4, 3, 2, 1].map((star) => ({ value: star, label: `${star} sao` }))}
          onChange={(rating) => setFilter({ rating })}
        />
        <Flex gap={8} align="center">
          <Text>Chỉ đánh giá đang ẩn</Text>
          <Switch
            checked={params.is_hidden === 'true'}
            onChange={(checked) => setFilter({ is_hidden: checked ? 'true' : undefined })}
          />
        </Flex>
      </Flex>

      {reviewsQuery.isError ? (
        <ErrorState error={reviewsQuery.error} onRetry={reviewsQuery.refetch} />
      ) : (
        <DataTable
          columns={columns}
          dataSource={reviewsQuery.data?.items ?? []}
          meta={reviewsQuery.data?.meta}
          loading={reviewsQuery.isFetching}
          emptyDescription="Chưa có đánh giá nào"
          onChangePage={(page, limit) => setParams((prev) => ({ ...prev, page, limit }))}
        />
      )}
    </>
  );
}
