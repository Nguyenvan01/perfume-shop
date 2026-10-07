import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Flex, Input, Row, Select, Space, Statistic, Switch, Tag, Typography } from 'antd';
import {
  ImportOutlined,
  ExportOutlined,
  SlidersOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';
import { PageHeader, DataTable, ErrorState } from '../../components';
import { formatCurrency } from '../../utils/format';
import { STATUS_LABEL } from '../../utils/constants';
import { useAuth } from '../../features/auth/AuthContext';
import { useCatalogOptions } from '../../features/products/components/useCatalogOptions';
import StockTag from '../../features/inventory/components/StockTag';
import StockMovementModal from '../../features/inventory/components/StockMovementModal';
import AdjustmentModal from '../../features/inventory/components/AdjustmentModal';

const { Text } = Typography;

export default function InventoryPage() {
  const [params, setParams] = useState({ page: 1, limit: 10, sort: 'stock_quantity:asc' });
  const [movementModal, setMovementModal] = useState({ open: false, type: 'IMPORT' });
  const [adjustModal, setAdjustModal] = useState({ open: false, row: null });

  const { isAdmin } = useAuth();
  const { brandOptions, categoryOptions } = useCatalogOptions();

  const summaryQuery = useQuery({
    queryKey: ['inventory', 'summary'],
    queryFn: inventoryApi.summary,
  });

  const stockQuery = useQuery({
    queryKey: ['inventory', 'list', params],
    queryFn: () => inventoryApi.list(params),
  });

  const threshold = summaryQuery.data?.low_stock_threshold ?? 5;
  const setFilter = (patch) => setParams((prev) => ({ ...prev, ...patch, page: 1 }));

  const columns = [
    {
      title: 'Sản phẩm',
      key: 'product',
      render: (_value, row) => (
        <Flex vertical>
          <Link to={`/admin/products/${row.product_id}`}>
            <strong>{row.product_name}</strong>
          </Link>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <code>{row.sku}</code> · {row.volume_ml}ml · {row.brand_name}
          </Text>
        </Flex>
      ),
    },
    { title: 'Danh mục', dataIndex: 'category_name', key: 'category_name' },
    {
      title: 'Giá niêm yết',
      dataIndex: 'price',
      key: 'price',
      align: 'right',
      render: formatCurrency,
    },
    {
      title: 'Tồn kho',
      dataIndex: 'stock_quantity',
      key: 'stock_quantity',
      align: 'right',
      sorter: true,
      render: (quantity) => <StockTag quantity={quantity} threshold={threshold} />,
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
      render: (_value, row) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<HistoryOutlined />}
            href={`/admin/inventory/transactions?variant_id=${row.variant_id}`}
          >
            Lịch sử
          </Button>
          {/* Điều chỉnh kho chỉ ADMIN — backend cũng trả 403 với STAFF. */}
          {isAdmin && (
            <Button
              size="small"
              icon={<SlidersOutlined />}
              onClick={() => setAdjustModal({ open: true, row })}
            >
              Điều chỉnh
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const summary = summaryQuery.data;

  return (
    <>
      <PageHeader
        title="Tồn kho"
        subtitle="Tồn kho theo từng biến thể dung tích. Mọi thay đổi đều được ghi lịch sử."
        extra={
          <Space wrap>
            <Button
              type="primary"
              icon={<ImportOutlined />}
              onClick={() => setMovementModal({ open: true, type: 'IMPORT' })}
            >
              Nhập kho
            </Button>
            <Button
              icon={<ExportOutlined />}
              onClick={() => setMovementModal({ open: true, type: 'EXPORT' })}
            >
              Xuất kho
            </Button>
            <Link to="/admin/inventory/transactions">
              <Button icon={<HistoryOutlined />}>Lịch sử kho</Button>
            </Link>
          </Space>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} md={6}>
          <Card loading={summaryQuery.isPending}>
            <Statistic title="Số biến thể" value={summary?.total_variants ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card loading={summaryQuery.isPending}>
            <Statistic title="Tổng tồn kho" value={summary?.total_stock ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card loading={summaryQuery.isPending}>
            <Statistic
              title={`Sắp hết (≤ ${threshold})`}
              value={summary?.low_stock_count ?? 0}
              valueStyle={{ color: (summary?.low_stock_count ?? 0) > 0 ? '#d46b08' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card loading={summaryQuery.isPending}>
            <Statistic
              title="Đã hết hàng"
              value={summary?.out_of_stock_count ?? 0}
              valueStyle={{ color: (summary?.out_of_stock_count ?? 0) > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={24}>
          <Card loading={summaryQuery.isPending}>
            <Statistic
              title="Giá trị tồn kho theo giá niêm yết"
              value={formatCurrency(summary?.stock_value ?? 0)}
            />
          </Card>
        </Col>
      </Row>

      <Flex gap={12} wrap align="center" style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Tìm theo SKU hoặc tên sản phẩm"
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
        <Flex gap={8} align="center">
          <Text>Chỉ hàng sắp hết</Text>
          <Switch
            checked={params.low_stock === 'true'}
            onChange={(checked) =>
              setFilter({ low_stock: checked ? 'true' : undefined, out_of_stock: undefined })
            }
          />
        </Flex>
        <Flex gap={8} align="center">
          <Text>Chỉ hàng đã hết</Text>
          <Switch
            checked={params.out_of_stock === 'true'}
            onChange={(checked) =>
              setFilter({ out_of_stock: checked ? 'true' : undefined, low_stock: undefined })
            }
          />
        </Flex>
      </Flex>

      {stockQuery.isError ? (
        <ErrorState error={stockQuery.error} onRetry={stockQuery.refetch} />
      ) : (
        <DataTable
          columns={columns}
          dataSource={stockQuery.data?.items ?? []}
          meta={stockQuery.data?.meta}
          loading={stockQuery.isFetching}
          rowKey="variant_id"
          emptyDescription="Không có biến thể nào khớp điều kiện"
          onChangePage={(page, limit) => setParams((prev) => ({ ...prev, page, limit }))}
          onChange={(_pagination, _filters, sorter) => {
            if (sorter?.field === 'stock_quantity') {
              setParams((prev) => ({
                ...prev,
                sort: `stock_quantity:${sorter.order === 'descend' ? 'desc' : 'asc'}`,
              }));
            }
          }}
        />
      )}

      <StockMovementModal
        open={movementModal.open}
        type={movementModal.type}
        onClose={() => setMovementModal({ open: false, type: movementModal.type })}
      />

      <AdjustmentModal
        open={adjustModal.open}
        row={adjustModal.row}
        onClose={() => setAdjustModal({ open: false, row: null })}
      />
    </>
  );
}
