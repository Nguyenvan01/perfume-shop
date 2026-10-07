import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Avatar, Button, Flex, Input, Select, Space, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { productsApi } from '../../api/catalog';
import { PageHeader, DataTable, ErrorState, ConfirmButton } from '../../components';
import { formatCurrency, formatNumber, formatLabel } from '../../utils/format';
import { GENDER_LABEL, CONCENTRATION_LABEL, STATUS_LABEL } from '../../utils/constants';
import { primaryImageUrl } from '../../utils/imageUrl';
import { useCatalogOptions } from '../../features/products/components/useCatalogOptions';

export default function ProductsPage() {
  const [params, setParams] = useState({ page: 1, limit: 10 });
  const { notification } = App.useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { brandOptions, categoryOptions } = useCatalogOptions();

  const productsQuery = useQuery({
    queryKey: ['products', 'admin', params],
    queryFn: () => productsApi.list(params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => productsApi.remove(id),
    onSuccess: () => {
      notification.success({ message: 'Đã xóa sản phẩm' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => notification.error({ message: error.message }),
  });

  const setFilter = (patch) => setParams((prev) => ({ ...prev, ...patch, page: 1 }));

  const columns = [
    {
      title: 'Ảnh',
      key: 'image',
      width: 72,
      render: (_value, record) => (
        <Avatar src={primaryImageUrl(record)} shape="square" size={48}>
          {record.name?.[0]}
        </Avatar>
      ),
    },
    {
      title: 'Sản phẩm',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Flex vertical>
          <Link to={`/admin/products/${record.id}`}>
            <strong>{name}</strong>
          </Link>
          <small style={{ color: '#888' }}>
            {record.brand?.name} · {formatLabel(CONCENTRATION_LABEL, record.concentration)} ·{' '}
            {formatLabel(GENDER_LABEL, record.gender)}
          </small>
        </Flex>
      ),
    },
    { title: 'Danh mục', dataIndex: ['category', 'name'], key: 'category' },
    {
      title: 'Biến thể',
      dataIndex: 'variant_count',
      key: 'variant_count',
      align: 'right',
      render: (count) => <Tag>{count} dung tích</Tag>,
    },
    {
      title: 'Khoảng giá',
      dataIndex: 'price_range',
      key: 'price_range',
      align: 'right',
      render: (range) =>
        !range
          ? '—'
          : range.min === range.max
            ? formatCurrency(range.min)
            : `${formatCurrency(range.min)} – ${formatCurrency(range.max)}`,
    },
    {
      title: 'Tổng tồn',
      dataIndex: 'total_stock',
      key: 'total_stock',
      align: 'right',
      render: (stock) => (
        <Tag color={stock === 0 ? 'red' : stock <= 5 ? 'orange' : 'green'}>
          {formatNumber(stock)}
        </Tag>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{STATUS_LABEL[status]}</Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      render: (_value, record) => (
        <Space size={4} wrap>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/admin/products/${record.id}`)}
          >
            Xem
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/admin/products/${record.id}/edit`)}
          >
            Sửa
          </Button>
          <ConfirmButton
            size="small"
            danger
            icon={<DeleteOutlined />}
            title="Xóa sản phẩm này?"
            description="Sản phẩm được xóa mềm, không còn hiện ở trang khách."
            loading={deleteMutation.isPending}
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            Xóa
          </ConfirmButton>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Quản lý sản phẩm"
        subtitle="Sản phẩm, biến thể dung tích và hình ảnh"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/admin/products/new')}
          >
            Thêm sản phẩm
          </Button>
        }
      />

      <Flex gap={12} wrap style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Tìm theo tên sản phẩm, thương hiệu"
          allowClear
          style={{ maxWidth: 280 }}
          onSearch={(value) => setFilter({ q: value })}
        />
        <Select
          placeholder="Thương hiệu"
          allowClear
          style={{ width: 170 }}
          options={brandOptions}
          onChange={(value) => setFilter({ brand_id: value })}
        />
        <Select
          placeholder="Danh mục"
          allowClear
          style={{ width: 170 }}
          options={categoryOptions}
          onChange={(value) => setFilter({ category_id: value })}
        />
        <Select
          placeholder="Giới tính"
          allowClear
          style={{ width: 140 }}
          options={Object.entries(GENDER_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(value) => setFilter({ gender: value })}
        />
        <Select
          placeholder="Trạng thái"
          allowClear
          style={{ width: 170 }}
          options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(value) => setFilter({ status: value })}
        />
      </Flex>

      {productsQuery.isError ? (
        <ErrorState error={productsQuery.error} onRetry={productsQuery.refetch} />
      ) : (
        <DataTable
          columns={columns}
          dataSource={productsQuery.data?.items ?? []}
          meta={productsQuery.data?.meta}
          loading={productsQuery.isFetching}
          emptyDescription="Không tìm thấy sản phẩm nào"
          onChangePage={(page, limit) => setParams((prev) => ({ ...prev, page, limit }))}
        />
      )}
    </>
  );
}
