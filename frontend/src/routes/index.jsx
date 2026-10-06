import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Result } from 'antd';

import AuthLayout from '../layouts/AuthLayout';
import CustomerLayout from '../layouts/CustomerLayout';
import AdminLayout from '../layouts/AdminLayout';
import ProtectedRoute from './ProtectedRoute';
import { ROLES } from '../utils/constants';

// Auth
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';

// Customer
import HomePage from '../pages/customer/HomePage';
import CustomerProductsPage from '../pages/customer/ProductsPage';
import CustomerProductDetailPage from '../pages/customer/ProductDetailPage';
import SearchPage from '../pages/customer/SearchPage';
import CartPage from '../pages/customer/CartPage';
import CheckoutPage from '../pages/customer/CheckoutPage';
import CustomerOrdersPage from '../pages/customer/OrdersPage';
import CustomerOrderDetailPage from '../pages/customer/OrderDetailPage';
import CustomerProfilePage from '../pages/customer/ProfilePage';

// Admin
import DashboardPage from '../pages/admin/DashboardPage';
import AdminProductsPage from '../pages/admin/ProductsPage';
import AdminProductFormPage from '../pages/admin/ProductFormPage';
import AdminProductDetailPage from '../pages/admin/ProductDetailPage';
import BrandsPage from '../pages/admin/BrandsPage';
import CategoriesPage from '../pages/admin/CategoriesPage';
import InventoryPage from '../pages/admin/InventoryPage';
import InventoryTransactionsPage from '../pages/admin/InventoryTransactionsPage';
import AdminOrdersPage from '../pages/admin/OrdersPage';
import AdminOrderDetailPage from '../pages/admin/OrderDetailPage';
import CustomersPage from '../pages/admin/CustomersPage';
import CustomerDetailPage from '../pages/admin/CustomerDetailPage';
import PromotionsPage from '../pages/admin/PromotionsPage';
import ReviewsPage from '../pages/admin/ReviewsPage';
import UsersPage from '../pages/admin/UsersPage';
import RolesPage from '../pages/admin/RolesPage';
import ReportsPage from '../pages/admin/ReportsPage';
import AdminProfilePage from '../pages/admin/ProfilePage';

const STAFF_OR_ADMIN = [ROLES.ADMIN, ROLES.STAFF];

export const router = createBrowserRouter([
  // ─── Auth ───
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },

  // ─── Customer website ───
  {
    path: '/',
    element: <CustomerLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'products', element: <CustomerProductsPage /> },
      { path: 'products/:slug', element: <CustomerProductDetailPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'cart', element: <CartPage /> },
      // Cần đăng nhập (role nào cũng được, nhưng thực tế là CUSTOMER)
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'checkout', element: <CheckoutPage /> },
          { path: 'orders', element: <CustomerOrdersPage /> },
          { path: 'orders/:id', element: <CustomerOrderDetailPage /> },
          { path: 'profile', element: <CustomerProfilePage /> },
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
          { index: true, element: <DashboardPage /> },
          { path: 'products', element: <AdminProductsPage /> },
          { path: 'products/new', element: <AdminProductFormPage /> },
          { path: 'products/:id', element: <AdminProductDetailPage /> },
          { path: 'products/:id/edit', element: <AdminProductFormPage /> },
          { path: 'brands', element: <BrandsPage /> },
          { path: 'categories', element: <CategoriesPage /> },
          { path: 'inventory', element: <InventoryPage /> },
          { path: 'inventory/transactions', element: <InventoryTransactionsPage /> },
          { path: 'orders', element: <AdminOrdersPage /> },
          { path: 'orders/:id', element: <AdminOrderDetailPage /> },
          { path: 'customers', element: <CustomersPage /> },
          { path: 'customers/:id', element: <CustomerDetailPage /> },
          { path: 'promotions', element: <PromotionsPage /> },
          { path: 'reviews', element: <ReviewsPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'profile', element: <AdminProfilePage /> },

          // ADMIN-only: STAFF vào sẽ thấy 403 (backend cũng trả 403 — TC09)
          {
            element: <ProtectedRoute allowedRoles={[ROLES.ADMIN]} />,
            children: [
              { path: 'users', element: <UsersPage /> },
              { path: 'roles', element: <RolesPage /> },
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
