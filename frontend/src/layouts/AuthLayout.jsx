import { Card, Flex, Layout, Typography } from 'antd';
import { Link, Outlet } from 'react-router-dom';

const { Title, Text } = Typography;

/** Layout cho Login / Register / Forgot / Reset password. */
export default function AuthLayout() {
  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Flex align="center" justify="center" style={{ minHeight: '100vh', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Flex vertical align="center" style={{ marginBottom: 20 }}>
            <Link to="/">
              <Title level={3} style={{ margin: 0 }}>
                Perfume Shop
              </Title>
            </Link>
            <Text type="secondary">Hệ thống quản lý shop nước hoa</Text>
          </Flex>
          <Card>
            <Outlet />
          </Card>
        </div>
      </Flex>
    </Layout>
  );
}
