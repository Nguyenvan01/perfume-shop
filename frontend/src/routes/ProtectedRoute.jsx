import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { LoadingState, ForbiddenState } from '../components';

/**
 * Guard theo role. Chỉ là UX — mọi endpoint vẫn phải tự check quyền ở backend.
 * @param {string[]} [allowedRoles] bỏ trống = chỉ cần đã đăng nhập
 */
export default function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, isHydrating, hasRole } = useAuth();
  const location = useLocation();

  // Đang lấy lại profile từ token — chưa kết luận được, tránh redirect nhầm khi F5.
  if (isHydrating) return <LoadingState tip="Đang kiểm tra phiên đăng nhập..." />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles?.length && !hasRole(...allowedRoles)) {
    return <ForbiddenState />;
  }

  return <Outlet />;
}
