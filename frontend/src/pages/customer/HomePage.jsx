import { useQuery } from '@tanstack/react-query';
import { Card, Col, Flex, Row, Statistic, Tag, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { healthApi } from '../../api/health';
import { ErrorState, LoadingState } from '../../components';

const { Title, Paragraph, Text } = Typography;

/**
 * Trang chủ W1 — hiển thị kết quả gọi GET /health để xác nhận FE ↔ BE đã nối được
 * (Definition of Done của M1). M4 sẽ thay bằng banner + danh sách sản phẩm thật.
 */
export default function HomePage() {
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: healthApi.check,
    retry: 1,
  });

  return (
    <Flex vertical gap={24}>
      <Card>
        <Title level={2} style={{ marginTop: 0 }}>
          Perfume Shop Management System
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Hệ thống quản lý shop nước hoa: quản lý sản phẩm theo dung tích, SKU, nhập – xuất – tồn,
          vòng đời đơn hàng và báo cáo từ dữ liệu thật.
        </Paragraph>
      </Card>

      <Card title="Kết nối backend">
        {healthQuery.isPending && <LoadingState tip="Đang kiểm tra kết nối..." />}

        {healthQuery.isError && (
          <ErrorState
            title="Không kết nối được backend"
            error={healthQuery.error}
            onRetry={healthQuery.refetch}
          />
        )}

        {healthQuery.isSuccess && (
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <Statistic
                title="Trạng thái"
                valueRender={() => (
                  <Tag
                    color={healthQuery.data.status === 'ok' ? 'green' : 'orange'}
                    icon={
                      healthQuery.data.status === 'ok' ? (
                        <CheckCircleOutlined />
                      ) : (
                        <CloseCircleOutlined />
                      )
                    }
                  >
                    {healthQuery.data.status}
                  </Tag>
                )}
              />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title="Database"
                valueRender={() => (
                  <Tag color={healthQuery.data.db === 'up' ? 'green' : 'red'}>
                    {healthQuery.data.db}
                  </Tag>
                )}
              />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Uptime (giây)" value={healthQuery.data.uptime} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="API version" value={healthQuery.data.version} />
            </Col>
          </Row>
        )}

        <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
          Màn hình trang chủ thật được triển khai ở M4 — Catalog.
        </Text>
      </Card>
    </Flex>
  );
}
