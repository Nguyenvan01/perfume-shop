import { useState } from 'react';
import { Breadcrumb, Button, Dropdown, Flex, Layout, Menu, Typography } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  TagsOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  UserOutlined,
  TeamOutlined,
  GiftOutlined,
  StarOutlined,
  SafetyOutlined,
  BarChartOutlined,
  LogoutOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { ROLES } from '../utils/constants';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

/**
 * Menu admin. `roles` = role được thấy item (ẩn menu chỉ là UX —
 * backend vẫn trả 403 nếu STAFF gọi API quản lý user/role).
 */
const MENU = [
  { key: '/admin', icon: <DashboardOutlined />, label: 'Dashboard', title: 'Dashboard' },
  { key: '/admin/products', icon: <ShoppingOutlined />, label: 'Sản phẩm', title: 'Sản phẩm' },
  { key: '/admin/brands', icon: <TagsOutlined />, label: 'Thương hiệu', title: 'Thương hiệu' },
  { key: '/admin/categories', icon: <AppstoreOutlined />, label: 'Danh mục', title: 'Danh mục' },
  { key: '/admin/inventory', icon: <DatabaseOutlined />, label: 'Tồn kho', title: 'Tồn kho' },
  {
    key: '/admin/inventory/transactions',
    icon: <FileTextOutlined />,
    label: 'Lịch sử kho',
    title: 'Lịch sử nhập xuất kho',
  },
  { key: '/admin/orders', icon: <FileTextOutlined />, label: 'Đơn hàng', title: 'Đơn hàng' },
  { key: '/admin/customers', icon: <TeamOutlined />, label: 'Khách hàng', title: 'Khách hàng' },
  { key: '/admin/promotions', icon: <GiftOutlined />, label: 'Khuyến mãi', title: 'Khuyến mãi' },
  { key: '/admin/reviews', icon: <StarOutlined />, label: 'Đánh giá', title: 'Đánh giá' },
  {
    key: '/admin/users',
    icon: <UserOutlined />,
    label: 'Người dùng',
    title: 'Người dùng',
    roles: [ROLES.ADMIN],
  },
  {
    key: '/admin/roles',
    icon: <SafetyOutlined />,
    label: 'Vai trò & quyền',
    title: 'Vai trò & quyền',
    roles: [ROLES.ADMIN],
  },
  { key: '/admin/reports', icon: <BarChartOutlined />, label: 'Báo cáo', title: 'Báo cáo' },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const visibleMenu = MENU.filter((item) => !item.roles || hasRole(...item.roles)).map(
    ({ key, icon, label }) => ({ key, icon, label: <Link to={key}>{label}</Link> })
  );

  // Khớp key dài nhất để sub-route (vd /admin/products/1) vẫn highlight đúng menu.
  const selectedKey =
    visibleMenu
      .map((item) => item.key)
      .filter((key) => location.pathname === key || location.pathname.startsWith(`${key}/`))
      .sort((a, b) => b.length - a.length)[0] || '/admin';

  const currentTitle = MENU.find((item) => item.key === selectedKey)?.title ?? 'Quản trị';

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: <Link to="/admin/profile">Hồ sơ</Link> },
    { key: 'shop', icon: <HomeOutlined />, label: <Link to="/">Về trang khách</Link> },
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
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} width={232} theme="dark">
        <div style={{ padding: 16, textAlign: 'center' }}>
          <Title level={5} style={{ color: '#fff', margin: 0, fontSize: collapsed ? 12 : 16 }}>
            {collapsed ? 'PS' : 'Perfume Admin'}
          </Title>
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={visibleMenu} />
      </Sider>

      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
          <Flex align="center" justify="space-between" style={{ height: '100%' }}>
            <Breadcrumb
              items={[{ title: <Link to="/admin">Quản trị</Link> }, { title: currentTitle }]}
            />
            <Dropdown
              menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
              placement="bottomRight"
            >
              <Button type="text" icon={<UserOutlined />}>
                <Flex vertical align="flex-start" style={{ lineHeight: 1.2 }}>
                  <span>{user?.full_name}</span>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {(user?.roles ?? []).join(', ')}
                  </Text>
                </Flex>
              </Button>
            </Dropdown>
          </Flex>
        </Header>

        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
