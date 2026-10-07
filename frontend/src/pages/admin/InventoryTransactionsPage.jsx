import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, DatePicker, Flex, Input, Select, Tag, Tooltip, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useSearchParams } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';
import { PageHeader, DataTable, ErrorState } from '../../components';
import { formatDateTime, formatNumber } from '../../utils/format';
import { INVENTORY_TYPE_LABEL } from '../../utils/constants';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const TYPE_COLOR = {
  IMPORT: 'green',
  EXPORT: 'orange',
  SALE: 'blue',
  RETURN: 'purple',
  ADJUSTMENT: 'gold',
};

export default function InventoryTransactionsPage() {
  const [searchParams] = useSearchParams();
  const variantIdFromUrl = searchParams.get('variant_id');

  const [params, setParams] = useState({
    page: 1,
    limit: 20,
    variant_id: variantIdFromUrl ? Number(variantIdFromUrl) : undefined,
  });

  const query = useQuery({
    queryKey: ['inventory', 'transactions', params],
    queryFn: () => inventoryApi.transactions(params),
  });

  const setFilter = (patch) => setParams((prev) => ({ ...prev, ...patch, page: 1 }));

  const columns = [
    {
      title: 'Thời gian',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: formatDateTime,
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag color={TYPE_COLOR[type]}>{INVENTORY_TYPE_LABEL[type] ?? type}</Tag>,
    },
    {
      title: 'Sản phẩm',
      key: 'variant',
      render: (_value, row) =>
        row.variant ? (
          <Flex vertical>
            <Link to={`/admin/products/${row.variant.product_id}`}>{row.variant.product_name}</Link>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <code>{row.variant.sku}</code> · {row.variant.volume_ml}ml
            </Text>
          </Flex>
        ) : (
          '—'
        ),
    },
    {
      title: 'Thay đổi',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
      render: (quantity) => (
        <Text strong style={{ color: quantity > 0 ? '#389e0d' : '#cf1322' }}>
          {quantity > 0 ? `+${formatNumber(quantity)}` : formatNumber(quantity)}
        </Text>
      ),
    },
    {
      // stock_before → stock_after cho phép đối chiếu từng bước, không chỉ số cuối.
      title: 'Tồn kho',
      key: 'stock',
      align: 'right',
      render: (_value, row) => (
        <Text type="secondary">
          {formatNumber(row.stock_before)} → <Text strong>{formatNumber(row.stock_after)}</Text>
        </Text>
      ),
    },
    {
      title: 'Tham chiếu',
      dataIndex: 'reference',
      key: 'reference',
      render: (reference) => (reference ? <code>{reference}</code> : '—'),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (note) => (note ? <Tooltip title={note}>{note}</Tooltip> : '—'),
    },
    {
      title: 'Người thực hiện',
      key: 'created_by',
      render: (_value, row) => row.created_by?.full_name ?? 'Hệ thống',
    },
  ];

  return (
    <>
      <PageHeader
        title="Lịch sử nhập xuất kho"
        subtitle="Mọi thay đổi tồn kho đều để lại một dòng ở đây, kèm tồn trước và sau"
        extra={
          <Link to="/admin/inventory">
            <Button icon={<ArrowLeftOutlined />}>Về tồn kho</Button>
          </Link>
        }
      />

      <Flex gap={12} wrap style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Tìm theo SKU hoặc tên sản phẩm"
          allowClear
          style={{ maxWidth: 280 }}
          onSearch={(value) => setFilter({ q: value })}
        />
        <Select
          placeholder="Loại giao dịch"
          allowClear
          style={{ width: 180 }}
          options={Object.entries(INVENTORY_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(value) => setFilter({ type: value })}
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
        {params.variant_id && (
          <Button onClick={() => setFilter({ variant_id: undefined })}>
            Bỏ lọc theo biến thể
          </Button>
        )}
      </Flex>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : (
        <DataTable
          columns={columns}
          dataSource={query.data?.items ?? []}
          meta={query.data?.meta}
          loading={query.isFetching}
          emptyDescription="Chưa có giao dịch kho nào"
          onChangePage={(page, limit) => setParams((prev) => ({ ...prev, page, limit }))}
        />
      )}
    </>
  );
}
