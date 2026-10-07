import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Alert, Card, Col, Flex, Row, Table, Tabs, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { reportsApi } from '../../api/reports';
import { PageHeader, ErrorState, LoadingState, EmptyState } from '../../components';
import { formatCurrency, formatNumber } from '../../utils/format';
import { ORDER_STATUS_LABEL } from '../../utils/constants';
import StatTile from '../../features/reports/components/StatTile';
import RangeFilter from '../../features/reports/components/RangeFilter';
import TimeSeriesChart from '../../features/reports/components/TimeSeriesChart';
import RankedBarChart from '../../features/reports/components/RankedBarChart';
import { compactCurrency, compactNumber } from '../../features/reports/components/scale';
import StockTag from '../../features/inventory/components/StockTag';

const { Text } = Typography;

/** Nhãn trục x: "07/10" cho dữ liệu theo ngày, "10/2026" cho theo tháng. */
const periodLabel = (period, groupBy) =>
  groupBy === 'month' ? dayjs(`${period}-01`).format('MM/YYYY') : dayjs(period).format('DD/MM');

export default function DashboardPage() {
  const [range, setRange] = useState({ range: '30d' });

  const [dashboard, revenue, topProducts, byBrand, orderStatus, lowStock] = useQueries({
    queries: [
      { queryKey: ['reports', 'dashboard', range], queryFn: () => reportsApi.dashboard(range) },
      { queryKey: ['reports', 'revenue', range], queryFn: () => reportsApi.revenue(range) },
      {
        queryKey: ['reports', 'top-products', range],
        queryFn: () => reportsApi.topProducts({ ...range, limit: 8 }),
      },
      {
        queryKey: ['reports', 'revenue-by-brand', range],
        queryFn: () => reportsApi.revenueByBrand(range),
      },
      { queryKey: ['reports', 'order-status', range], queryFn: () => reportsApi.orderStatus(range) },
      { queryKey: ['reports', 'low-stock'], queryFn: () => reportsApi.lowStock({ limit: 8 }) },
    ],
  });

  const kpi = dashboard.data;
  const series = revenue.data?.series ?? [];
  const groupBy = revenue.data?.group_by ?? 'day';

  // Chỉ vẽ trạng thái có đơn, nhưng vẫn giữ thứ tự vòng đời.
  const statusItems = (orderStatus.data?.items ?? []).filter((row) => row.count > 0);

  if (dashboard.isError) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <ErrorState error={dashboard.error} onRetry={dashboard.refetch} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Số liệu lấy trực tiếp từ cơ sở dữ liệu. Doanh thu chỉ tính đơn đã hoàn thành."
      />

      <Flex style={{ marginBottom: 20 }}>
        <RangeFilter value={range} onChange={setRange} />
      </Flex>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatTile
            loading={dashboard.isPending}
            label="Doanh thu"
            value={formatCurrency(kpi?.revenue ?? 0)}
            changePct={kpi?.revenue_change_pct}
            hint="Chỉ tính đơn đã hoàn thành"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatTile
            loading={dashboard.isPending}
            label="Đơn hàng mới"
            value={formatNumber(kpi?.order_count ?? 0)}
            hint={`${formatNumber(kpi?.completed_order_count ?? 0)} đơn hoàn thành trong kỳ`}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatTile
            loading={dashboard.isPending}
            label="Khách hàng"
            value={formatNumber(kpi?.customer_count ?? 0)}
            hint={`${formatNumber(kpi?.new_customer_count ?? 0)} khách mới trong kỳ`}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatTile
            loading={dashboard.isPending}
            label="Sản phẩm đang bán"
            value={formatNumber(kpi?.product_count ?? 0)}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12}>
          <StatTile
            loading={dashboard.isPending}
            label="Đơn chờ xác nhận"
            value={formatNumber(kpi?.pending_order_count ?? 0)}
            danger={(kpi?.pending_order_count ?? 0) > 0}
            hint="Cần xử lý"
          />
        </Col>
        <Col xs={24} sm={12}>
          <StatTile
            loading={dashboard.isPending}
            label="Biến thể sắp hết hàng"
            value={formatNumber(kpi?.low_stock_count ?? 0)}
            danger={(kpi?.low_stock_count ?? 0) > 0}
            hint={`Ngưỡng cảnh báo: còn ≤ ${kpi?.low_stock_threshold ?? 5}`}
          />
        </Col>
      </Row>

      {(kpi?.pending_order_count ?? 0) > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
          message={`Có ${kpi.pending_order_count} đơn đang chờ xác nhận`}
          action={<Link to="/admin/orders?status=PENDING">Xử lý đơn</Link>}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card
            title="Doanh thu theo thời gian"
            extra={<Text type="secondary">{groupBy === 'month' ? 'Theo tháng' : 'Theo ngày'}</Text>}
          >
            {revenue.isPending ? (
              <LoadingState rows={4} />
            ) : revenue.isError ? (
              <ErrorState error={revenue.error} onRetry={revenue.refetch} />
            ) : (
              <TimeSeriesChart
                data={series}
                variant="line"
                valueOf={(row) => Number(row.revenue)}
                labelOf={(row) => periodLabel(row.period, groupBy)}
                formatTick={compactCurrency}
                formatValue={formatCurrency}
                tooltipLabel="Doanh thu"
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          {/* Hai thước đo khác đơn vị → hai biểu đồ riêng, không dùng hai trục y */}
          <Card title="Số đơn hoàn thành theo thời gian">
            {revenue.isPending ? (
              <LoadingState rows={4} />
            ) : (
              <TimeSeriesChart
                data={series}
                variant="column"
                valueOf={(row) => row.order_count}
                labelOf={(row) => periodLabel(row.period, groupBy)}
                formatTick={compactNumber}
                formatValue={formatNumber}
                tooltipLabel="Số đơn"
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card title="Sản phẩm bán chạy">
            {topProducts.isPending ? (
              <LoadingState rows={4} />
            ) : (
              <RankedBarChart
                data={topProducts.data?.items ?? []}
                valueOf={(row) => row.quantity_sold}
                labelOf={(row) => row.product_name}
                subLabelOf={(row) => ({ label: 'Doanh thu', value: formatCurrency(row.revenue) })}
                formatValue={(value) => `${formatNumber(value)} chai`}
                tooltipLabel="Đã bán"
                emptyDescription="Chưa có đơn hoàn thành nào trong kỳ"
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card
            title="Doanh thu theo thương hiệu"
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                Tiền hàng, chưa gồm phí ship
              </Text>
            }
          >
            {byBrand.isPending ? (
              <LoadingState rows={4} />
            ) : (
              <>
                <RankedBarChart
                  data={byBrand.data?.items ?? []}
                  valueOf={(row) => Number(row.revenue)}
                  labelOf={(row) => row.brand_name}
                  subLabelOf={(row) => ({ label: 'Tỷ trọng', value: `${row.share_pct}%` })}
                  formatValue={compactCurrency}
                  tooltipLabel="Doanh thu"
                  emptyDescription="Chưa có doanh thu trong kỳ"
                />
                {/* Tổng ở đây nhỏ hơn KPI Doanh thu vì phí ship và giảm giá
                    toàn đơn không thuộc về thương hiệu nào. */}
                {(byBrand.data?.items ?? []).length > 0 && (
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
                    Tổng {formatCurrency(byBrand.data.total_revenue)} — thấp hơn KPI Doanh thu vì
                    không tính phí vận chuyển và giảm giá toàn đơn.
                  </Text>
                )}
              </>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card title="Đơn hàng theo trạng thái">
            {orderStatus.isPending ? (
              <LoadingState rows={3} />
            ) : (
              <RankedBarChart
                data={statusItems}
                valueOf={(row) => row.count}
                labelOf={(row) => ORDER_STATUS_LABEL[row.status] ?? row.status}
                formatValue={(value) => `${formatNumber(value)} đơn`}
                tooltipLabel="Số đơn"
                emptyDescription="Chưa có đơn hàng nào trong kỳ"
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card
            title="Sản phẩm sắp hết hàng"
            extra={<Link to="/admin/inventory?low_stock=true">Xem tồn kho</Link>}
          >
            {lowStock.isPending ? (
              <LoadingState rows={3} />
            ) : (
              <Table
                size="small"
                rowKey="variant_id"
                pagination={false}
                dataSource={lowStock.data?.items ?? []}
                locale={{ emptyText: <EmptyState description="Không có hàng nào sắp hết" /> }}
                columns={[
                  {
                    title: 'Sản phẩm',
                    key: 'product',
                    render: (_value, row) => (
                      <Flex vertical>
                        <Link to={`/admin/products/${row.product_id}`}>{row.product_name}</Link>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          <code>{row.sku}</code> · {row.volume_ml}ml
                        </Text>
                      </Flex>
                    ),
                  },
                  { title: 'Thương hiệu', dataIndex: 'brand_name', key: 'brand_name' },
                  {
                    title: 'Tồn',
                    dataIndex: 'stock_quantity',
                    key: 'stock_quantity',
                    align: 'right',
                    render: (quantity) => (
                      <StockTag
                        quantity={quantity}
                        threshold={lowStock.data?.low_stock_threshold ?? 5}
                      />
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Bảng số liệu: kênh thay thế cho biểu đồ, bảo đảm không có gì chỉ đọc được bằng màu */}
      <Card title="Bảng số liệu" style={{ marginTop: 16 }}>
        <Tabs
          items={[
            {
              key: 'revenue',
              label: 'Doanh thu',
              children: (
                <Table
                  size="small"
                  rowKey="period"
                  pagination={false}
                  scroll={{ y: 280 }}
                  dataSource={series}
                  locale={{ emptyText: <EmptyState description="Chưa có doanh thu" /> }}
                  columns={[
                    {
                      title: groupBy === 'month' ? 'Tháng' : 'Ngày',
                      dataIndex: 'period',
                      key: 'period',
                      render: (period) => periodLabel(period, groupBy),
                    },
                    {
                      title: 'Doanh thu',
                      dataIndex: 'revenue',
                      key: 'revenue',
                      align: 'right',
                      render: formatCurrency,
                    },
                    {
                      title: 'Số đơn',
                      dataIndex: 'order_count',
                      key: 'order_count',
                      align: 'right',
                    },
                  ]}
                />
              ),
            },
            {
              key: 'status',
              label: 'Trạng thái đơn',
              children: (
                <Table
                  size="small"
                  rowKey="status"
                  pagination={false}
                  dataSource={orderStatus.data?.items ?? []}
                  columns={[
                    {
                      title: 'Trạng thái',
                      dataIndex: 'status',
                      key: 'status',
                      render: (status) => <Tag>{ORDER_STATUS_LABEL[status] ?? status}</Tag>,
                    },
                    { title: 'Số đơn', dataIndex: 'count', key: 'count', align: 'right' },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
