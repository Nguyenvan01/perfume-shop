import { useQuery } from '@tanstack/react-query';
import { Button, Card, Descriptions, Flex, Image, Table, Tag } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { productsApi } from '../../api/catalog';
import { PageHeader, QueryBoundary, EmptyState } from '../../components';
import { formatCurrency, formatNumber, formatLabel, formatDateTime } from '../../utils/format';
import { GENDER_LABEL, CONCENTRATION_LABEL, STATUS_LABEL } from '../../utils/constants';
import { resolveImageUrl } from '../../utils/imageUrl';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const productQuery = useQuery({
    queryKey: ['products', 'detail', id],
    queryFn: () => productsApi.detail(id),
  });

  const variantColumns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', render: (value) => <code>{value}</code> },
    { title: 'Dung tích', dataIndex: 'volume_ml', key: 'volume_ml', render: (v) => `${v} ml` },
    { title: 'Giá niêm yết', dataIndex: 'price', key: 'price', align: 'right', render: formatCurrency },
    {
      title: 'Giá bán',
      dataIndex: 'sale_price',
      key: 'sale_price',
      align: 'right',
      render: (value) => (value == null ? '—' : formatCurrency(value)),
    },
    {
      title: 'Tồn kho',
      dataIndex: 'stock_quantity',
      key: 'stock_quantity',
      align: 'right',
      render: (value) => (
        <Tag color={value === 0 ? 'red' : value <= 5 ? 'orange' : 'green'}>{formatNumber(value)}</Tag>
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
  ];

  return (
    <QueryBoundary query={productQuery} skeletonRows={8}>
      {(product) => (
        <>
          <PageHeader
            title={product.name}
            subtitle={`${product.brand?.name} · ${product.category?.name}`}
            extra={
              <Flex gap={8}>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/products')}>
                  Về danh sách
                </Button>
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/admin/products/${product.id}/edit`)}
                >
                  Sửa
                </Button>
              </Flex>
            }
          />

          <Flex vertical gap={16}>
            <Card title="Thông tin chung">
              <Descriptions
                column={{ xs: 1, sm: 2, lg: 3 }}
                items={[
                  { key: 'slug', label: 'Slug', children: <code>{product.slug}</code> },
                  { key: 'brand', label: 'Thương hiệu', children: product.brand?.name },
                  { key: 'category', label: 'Danh mục', children: product.category?.name },
                  {
                    key: 'gender',
                    label: 'Giới tính',
                    children: formatLabel(GENDER_LABEL, product.gender),
                  },
                  {
                    key: 'concentration',
                    label: 'Nồng độ',
                    children: formatLabel(CONCENTRATION_LABEL, product.concentration),
                  },
                  { key: 'origin', label: 'Xuất xứ', children: product.origin || '—' },
                  {
                    key: 'family',
                    label: 'Nhóm hương',
                    children: product.fragrance_family || '—',
                  },
                  {
                    key: 'status',
                    label: 'Trạng thái',
                    children: (
                      <Tag color={product.status === 'ACTIVE' ? 'green' : 'default'}>
                        {STATUS_LABEL[product.status]}
                      </Tag>
                    ),
                  },
                  {
                    key: 'stock',
                    label: 'Tổng tồn kho',
                    children: formatNumber(product.total_stock),
                  },
                  {
                    key: 'created',
                    label: 'Ngày tạo',
                    children: formatDateTime(product.created_at),
                  },
                  {
                    key: 'description',
                    label: 'Mô tả',
                    span: 3,
                    children: product.description || '—',
                  },
                ]}
              />
            </Card>

            <Card title={`Biến thể dung tích (${product.variants.length})`}>
              <Table
                size="small"
                rowKey="id"
                columns={variantColumns}
                dataSource={product.variants}
                pagination={false}
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: <EmptyState description="Chưa có biến thể nào" /> }}
              />
            </Card>

            <Card title={`Hình ảnh (${product.images.length})`}>
              {product.images.length === 0 ? (
                <EmptyState description="Chưa có ảnh nào" />
              ) : (
                <Image.PreviewGroup>
                  <Flex gap={12} wrap>
                    {product.images.map((image) => (
                      <Flex key={image.id} vertical align="center" gap={4}>
                        <Image
                          src={resolveImageUrl(image.image_url)}
                          alt={`Ảnh ${product.name}`}
                          width={140}
                          height={140}
                          style={{ objectFit: 'cover', borderRadius: 6 }}
                        />
                        {image.is_primary && <Tag color="gold">Ảnh chính</Tag>}
                      </Flex>
                    ))}
                  </Flex>
                </Image.PreviewGroup>
              )}
            </Card>
          </Flex>
        </>
      )}
    </QueryBoundary>
  );
}
