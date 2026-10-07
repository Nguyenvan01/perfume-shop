import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Result } from 'antd';

import AuthLayout from '../layouts/AuthLayout';
import CustomerLayout from '../layouts/CustomerLayout';
import AdminLayout from '../layouts/AdminLayout';
import ProtectedRoute from './ProtectedRoute';
import { LoadingState } from '../components';
import { ROLES } from '../utils/constants';

/**
 * Mỗi page là một chunk riêng (React.lazy).
 * Khách vào trang chủ không phải tải code của Admin Portal, và biểu đồ
 * Dashboard chỉ được tải khi thực sự mở Dashboard.
 */

const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage'));
const HomePage = lazy(() => import('../pages/customer/HomePage'));
const CustomerProductsPage = lazy(() => import('../pages/customer/ProductsPage'));
const CustomerProductDetailPage = lazy(() => import('../pages/customer/ProductDetailPage'));
const SearchPage = lazy(() => import('../pages/customer/SearchPage'));
const CartPage = lazy(() => import('../pages/customer/CartPage'));
const CheckoutPage = lazy(() => import('../pages/customer/CheckoutPage'));
const CustomerOrdersPage = lazy(() => import('../pages/customer/OrdersPage'));
const CustomerOrderDetailPage = lazy(() => import('../pages/customer/OrderDetailPage'));
const CustomerProfilePage = lazy(() => import('../pages/customer/ProfilePage'));
const DashboardPage = lazy(() => import('../pages/admin/DashboardPage'));
const AdminProductsPage = lazy(() => import('../pages/admin/ProductsPage'));
const AdminProductFormPage = lazy(() => import('../pages/admin/ProductFormPage'));
const AdminProductDetailPage = lazy(() => import('../pages/admin/ProductDetailPage'));
const BrandsPage = lazy(() => import('../pages/admin/BrandsPage'));
const CategoriesPage = lazy(() => import('../pages/admin/CategoriesPage'));
const InventoryPage = lazy(() => import('../pages/admin/InventoryPage'));
const InventoryTransactionsPage = lazy(() => import('../pages/admin/InventoryTransactionsPage'));
const AdminOrdersPage = lazy(() => import('../pages/admin/OrdersPage'));
const AdminOrderDetailPage = lazy(() => import('../pages/admin/OrderDetailPage'));
const CustomersPage = lazy(() => import('../pages/admin/CustomersPage'));
const CustomerDetailPage = lazy(() => import('../pages/admin/CustomerDetailPage'));
const PromotionsPage = lazy(() => import('../pages/admin/PromotionsPage'));
const ReviewsPage = lazy(() => import('../pages/admin/ReviewsPage'));
const UsersPage = lazy(() => import('../pages/admin/UsersPage'));
const RolesPage = lazy(() => import('../pages/admin/RolesPage'));
const ReportsPage = lazy(() => import('../pages/admin/ReportsPage'));
const AdminProfilePage = lazy(() => import('../pages/admin/ProfilePage'));

/** Khung chờ khi chunk của page đang được tải. */
const Lazy = ({ children }) => (
  <Suspense fallback={<LoadingState tip="Đang tải trang..." />}>{children}</Suspense>
);

const STAFF_OR_ADMIN = [ROLES.ADMIN, ROLES.STAFF];

export const router = createBrowserRouter([
  // ─── Auth ───
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <Lazy><LoginPage /></Lazy> },
      { path: '/register', element: <Lazy><RegisterPage /></Lazy> },
      { path: '/forgot-password', element: <Lazy><ForgotPasswordPage /></Lazy> },
      { path: '/reset-password', element: <Lazy><ResetPasswordPage /></Lazy> },
    ],
  },

  // ─── Customer website ───
  {
    path: '/',
    element: <CustomerLayout />,
    children: [
      { index: true, element: <Lazy><HomePage /></Lazy> },
      { path: 'products', element: <Lazy><CustomerProductsPage /></Lazy> },
      { path: 'products/:slug', element: <Lazy><CustomerProductDetailPage /></Lazy> },
      { path: 'search', element: <Lazy><SearchPage /></Lazy> },
      { path: 'cart', element: <Lazy><CartPage /></Lazy> },
      // Cần đăng nhập (role nào cũng được, nhưng thực tế là CUSTOMER)
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'checkout', element: <Lazy><CheckoutPage /></Lazy> },
          { path: 'orders', element: <Lazy><CustomerOrdersPage /></Lazy> },
          { path: 'orders/:id', element: <Lazy><CustomerOrderDetailPage /></Lazy> },
          { path: 'profile', element: <Lazy><CustomerProfilePage /></Lazy> },
        ],
      },
    ],
  },

  // ─── Admin portal ───
  {
    path: '/admin',
    element: <ProtectedRoute allowedRoles={STAFF_OR_ADMIN} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <Lazy><DashboardPage /></Lazy> },
          { path: 'products', element: <Lazy><AdminProductsPage /></Lazy> },
          { path: 'products/new', element: <Lazy><AdminProductFormPage /></Lazy> },
          { path: 'products/:id', element: <Lazy><AdminProductDetailPage /></Lazy> },
          { path: 'products/:id/edit', element: <Lazy><AdminProductFormPage /></Lazy> },
          { path: 'brands', element: <Lazy><BrandsPage /></Lazy> },
          { path: 'categories', element: <Lazy><CategoriesPage /></Lazy> },
          { path: 'inventory', element: <Lazy><InventoryPage /></Lazy> },
          { path: 'inventory/transactions', element: <Lazy><InventoryTransactionsPage /></Lazy> },
          { path: 'orders', element: <Lazy><AdminOrdersPage /></Lazy> },
          { path: 'orders/:id', element: <Lazy><AdminOrderDetailPage /></Lazy> },
          { path: 'customers', element: <Lazy><CustomersPage /></Lazy> },
          { path: 'customers/:id', element: <Lazy><CustomerDetailPage /></Lazy> },
          { path: 'promotions', element: <Lazy><PromotionsPage /></Lazy> },
          { path: 'reviews', element: <Lazy><ReviewsPage /></Lazy> },
          { path: 'reports', element: <Lazy><ReportsPage /></Lazy> },
          { path: 'profile', element: <Lazy><AdminProfilePage /></Lazy> },

          // ADMIN-only: STAFF vào sẽ thấy 403 (backend cũng trả 403 — TC09)
          {
            element: <ProtectedRoute allowedRoles={[ROLES.ADMIN]} />,
            children: [
              { path: 'users', element: <Lazy><UsersPage /></Lazy> },
              { path: 'roles', element: <Lazy><RolesPage /></Lazy> },
            ],
          },
        ],
      },
    ],
  },

  {
    path: '*',
    element: (
      <Result
        status="404"
        title="404"
        subTitle="Không tìm thấy trang bạn yêu cầu."
        extra={<Navigate to="/" replace />}
      />
    ),
  },
]);
