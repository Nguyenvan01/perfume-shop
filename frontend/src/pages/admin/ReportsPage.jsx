import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Button, Card, Col, Flex, Row, Table, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportsApi } from '../../api/reports';
import { PageHeader, ErrorState, LoadingState, EmptyState } from '../../components';
import { formatCurrency, formatNumber } from '../../utils/format';
import RangeFilter from '../../features/reports/components/RangeFilter';

const { Text } = Typography;

/** Xuất CSV ngay ở client — không cần endpoint riêng cho việc tải file. */
function downloadCsv(filename, headers, rows) {
  const escape = (value) => {
    const text = String(value ?? '');
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  // BOM để Excel trên Windows đọc đúng tiếng Việt.
  const csv = ['﻿' + headers.map(escape).join(';'), ...rows.map((row) => row.map(escape).join(';'))].join(
    '\n'
  );

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [range, setRange] = useState({ range: '30d' });

  const [revenue, topProducts, byBrand, lowStock] = useQueries({
    queries: [
      { queryKey: ['reports', 'revenue', range], queryFn: () => reportsApi.revenue(range) },
      {
        queryKey: ['reports', 'top-products', 'full', range],
        queryFn: () => reportsApi.topProducts({ ...range, limit: 50 }),
      },
      {
        queryKey: ['reports', 'revenue-by-brand', range],
        queryFn: () => reportsApi.revenueByBrand(range),
      },
      { queryKey: ['reports', 'low-stock', 'full'], queryFn: () => reportsApi.lowStock({ limit: 50 }) },
    ],
  });

  const series = revenue.data?.series ?? [];
  const groupBy = revenue.data?.group_by ?? 'day';
  const suffix = range.range === 'custom' ? `${range.from}_${range.to}` : range.range;

  const totalRevenue = series.reduce((sum, row) => sum + Number(row.revenue), 0);
  const totalOrders = series.reduce((sum, row) => sum + row.order_count, 0);

  if (revenue.isError) {
    return (
      <>
        <PageHeader title="Báo cáo" />
        <ErrorState error={revenue.error} onRetry={revenue.refetch} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Báo cáo"
        subtitle="Số liệu dạng bảng, tải được ra CSV để làm báo cáo ngoài hệ thống"
      />

      <Flex style={{ marginBottom: 20 }}>
        <RangeFilter value={range} onChange={setRange} />
      </Flex>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card
            title={`Doanh thu theo ${groupBy === 'month' ? 'tháng' : 'ngày'}`}
            extra={
              <Button
                size="small"
                icon={<DownloadOutlined />}
                disabled={series.length === 0}
                onClick={() =>
                  downloadCsv(
                    `doanh-thu_${suffix}.csv`,
                    ['Kỳ', 'Doanh thu', 'Số đơn hoàn thành'],
                    series.map((row) => [row.period, row.revenue, row.order_count])
                  )
                }
              >
                CSV
              </Button>
            }
          >
            {revenue.isPending ? (
              <LoadingState rows={4} />
            ) : (
              <Table
                size="small"
                rowKey="period"
                pagination={false}
                scroll={{ y: 320 }}
                dataSource={series}
                locale={{ emptyText: <EmptyState description="Chưa có doanh thu trong kỳ" /> }}
                columns={[
                  {
                    title: groupBy === 'month' ? 'Tháng' : 'Ngày',
                    dataIndex: 'period',
                    key: 'period',
                    render: (period) =>
                      groupBy === 'month'
                        ? dayjs(`${period}-01`).format('MM/YYYY')
                        : dayjs(period).format('DD/MM/YYYY'),
                  },
                  {
                    title: 'Doanh thu',
                    dataIndex: 'revenue',
                    key: 'revenue',
                    align: 'right',
                    render: formatCurrency,
                  },
                  { title: 'Số đơn', dataIndex: 'order_count', key: 'order_count', align: 'right' },
                ]}
                summary={() =>
                  series.length > 0 && (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}>
                        <Text strong>Tổng</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <Text strong>{formatCurrency(totalRevenue)}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <Text strong>{formatNumber(totalOrders)}</Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  )
                }
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card
            title="Doanh thu theo thương hiệu"
            extra={
              <Button
                size="small"
                icon={<DownloadOutlined />}
                disabled={(byBrand.data?.items ?? []).length === 0}
                onClick={() =>
                  downloadCsv(
                    `doanh-thu-thuong-hieu_${suffix}.csv`,
                    ['Thương hiệu', 'Doanh thu', 'Số đơn', 'Tỷ trọng %'],
                    (byBrand.data?.items ?? []).map((row) => [
                      row.brand_name,
                      row.revenue,
                      row.order_count,
                      row.share_pct,
                    ])
                  )
                }
              >
                CSV
              </Button>
            }
          >
            {byBrand.isPending ? (
              <LoadingState rows={4} />
            ) : (
              <Table
                size="small"
                rowKey="brand_id"
                pagination={false}
                scroll={{ y: 320 }}
                dataSource={byBrand.data?.items ?? []}
                locale={{ emptyText: <EmptyState description="Chưa có doanh thu trong kỳ" /> }}
                columns={[
                  { title: 'Thương hiệu', dataIndex: 'brand_name', key: 'brand_name' },
                  {
                    title: 'Doanh thu',
                    dataIndex: 'revenue',
                    key: 'revenue',
                    align: 'right',
                    render: formatCurrency,
                  },
                  { title: 'Số đơn', dataIndex: 'order_count', key: 'order_count', align: 'right' },
                  {
                    title: 'Tỷ trọng',
                    dataIndex: 'share_pct',
                    key: 'share_pct',
                    align: 'right',
                    render: (pct) => `${pct}%`,
                  },
                ]}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card
            title="Sản phẩm bán chạy"
            extra={
              <Button
                size="small"
                icon={<DownloadOutlined />}
                disabled={(topProducts.data?.items ?? []).length === 0}
                onClick={() =>
                  downloadCsv(
                    `san-pham-ban-chay_${suffix}.csv`,
                    ['Sản phẩm', 'Thương hiệu', 'Số lượng bán', 'Doanh thu'],
                    (topProducts.data?.items ?? []).map((row) => [
                      row.product_name,
                      row.brand_name,
                      row.quantity_sold,
                      row.revenue,
                    ])
                  )
                }
              >
                CSV
              </Button>
            }
          >
            {topProducts.isPending ? (
              <LoadingState rows={4} />
            ) : (
              <Table
                size="small"
                rowKey="product_id"
                pagination={{ pageSize: 10, showSizeChanger: false }}
                dataSource={topProducts.data?.items ?? []}
                locale={{ emptyText: <EmptyState description="Chưa có đơn hoàn thành nào" /> }}
                columns={[
                  { title: 'Sản phẩm', dataIndex: 'product_name', key: 'product_name' },
                  { title: 'Thương hiệu', dataIndex: 'brand_name', key: 'brand_name' },
                  {
                    title: 'Đã bán',
                    dataIndex: 'quantity_sold',
                    key: 'quantity_sold',
                    align: 'right',
                    render: formatNumber,
                  },
                  {
                    title: 'Doanh thu',
                    dataIndex: 'revenue',
                    key: 'revenue',
                    align: 'right',
                    render: formatCurrency,
                  },
                ]}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card
            title="Sản phẩm sắp hết hàng"
            extra={
              <Button
                size="small"
                icon={<DownloadOutlined />}
                disabled={(lowStock.data?.items ?? []).length === 0}
                onClick={() =>
                  downloadCsv(
                    'san-pham-sap-het-hang.csv',
                    ['SKU', 'Sản phẩm', 'Thương hiệu', 'Dung tích (ml)', 'Tồn kho'],
                    (lowStock.data?.items ?? []).map((row) => [
                      row.sku,
                      row.product_name,
                      row.brand_name,
                      row.volume_ml,
                      row.stock_quantity,
                    ])
                  )
                }
              >
                CSV
              </Button>
            }
          >
            {lowStock.isPending ? (
              <LoadingState rows={4} />
            ) : (
              <Table
                size="small"
                rowKey="variant_id"
                pagination={{ pageSize: 10, showSizeChanger: false }}
                dataSource={lowStock.data?.items ?? []}
                locale={{ emptyText: <EmptyState description="Không có hàng nào sắp hết" /> }}
                columns={[
                  {
                    title: 'SKU',
                    dataIndex: 'sku',
                    key: 'sku',
                    render: (sku) => <code>{sku}</code>,
                  },
                  { title: 'Sản phẩm', dataIndex: 'product_name', key: 'product_name' },
                  { title: 'Thương hiệu', dataIndex: 'brand_name', key: 'brand_name' },
                  {
                    title: 'Dung tích',
                    dataIndex: 'volume_ml',
                    key: 'volume_ml',
                    align: 'right',
                    render: (volume) => `${volume} ml`,
                  },
                  {
                    title: 'Tồn kho',
                    dataIndex: 'stock_quantity',
                    key: 'stock_quantity',
                    align: 'right',
                  },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}
