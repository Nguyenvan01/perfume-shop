import { Badge, Button, Dropdown, Flex, Input, Layout, Menu, Typography } from 'antd';
import {
  ShoppingCartOutlined,
  UserOutlined,
  LogoutOutlined,
  HistoryOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { useCart } from '../features/cart/useCart';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

const NAV_ITEMS = [
  { key: '/', label: <Link to="/">Trang chủ</Link> },
  { key: '/products', label: <Link to="/products">Sản phẩm</Link> },
];

export default function CustomerLayout() {
  const { isAuthenticated, user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { itemCount: cartItemCount, hasWarnings } = useCart();

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: <Link to="/profile">Hồ sơ của tôi</Link> },
    { key: 'orders', icon: <HistoryOutlined />, label: <Link to="/orders">Đơn hàng của tôi</Link> },
    ...(hasRole('ADMIN', 'STAFF')
      ? [{ key: 'admin', icon: <DashboardOutlined />, label: <Link to="/admin">Trang quản trị</Link> }]
      : []),
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, danger: true, label: 'Đăng xuất' },
  ];

  const handleUserMenuClick = async ({ key }) => {
    if (key === 'logout') {
      await logout();
      navigate('/login');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '0 24px' }}>
        <Flex align="center" gap={24} style={{ height: '100%' }}>
          <Link to="/">
            <Title level={4} style={{ margin: 0, whiteSpace: 'nowrap' }}>
              Perfume Shop
            </Title>
          </Link>

          <Menu
            mode="horizontal"
            selectedKeys={[location.pathname]}
            items={NAV_ITEMS}
            style={{ flex: 1, borderBottom: 'none' }}
          />

          <Input.Search
            placeholder="Tìm nước hoa..."
            allowClear
            style={{ maxWidth: 260 }}
            onSearch={(value) => navigate(`/search?q=${encodeURIComponent(value)}`)}
          />

          <Link to="/cart">
            {/* Dấu chấm đỏ khi giỏ có sản phẩm hết hàng / vượt tồn kho. */}
            <Badge count={cartItemCount} size="small" dot={hasWarnings && cartItemCount === 0}>
              <Button type="text" icon={<ShoppingCartOutlined style={{ fontSize: 18 }} />} />
            </Badge>
          </Link>

          {isAuthenticated ? (
            <Dropdown
              menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
              placement="bottomRight"
            >
              <Button type="text" icon={<UserOutlined />}>
                {user?.full_name}
              </Button>
            </Dropdown>
          ) : (
            <Flex gap={8}>
              <Button onClick={() => navigate('/login')}>Đăng nhập</Button>
              <Button type="primary" onClick={() => navigate('/register')}>
                Đăng ký
              </Button>
            </Flex>
          )}
        </Flex>
      </Header>

      <Content style={{ padding: 24, maxWidth: 1280, margin: '0 auto', width: '100%' }}>
        <Outlet />
      </Content>

      <Footer style={{ textAlign: 'center' }}>
        <Text type="secondary">Perfume Shop Management System — Đồ án</Text>
      </Footer>
    </Layout>
  );
}
