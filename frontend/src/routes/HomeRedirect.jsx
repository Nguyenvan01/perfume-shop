import { Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

/** Sau login: ADMIN/STAFF vào admin portal, CUSTOMER về trang khách. */
export default function HomeRedirect() {
  const { isHydrating, hasRole } = useAuth();
  if (isHydrating) return null;
  return <Navigate to={hasRole('ADMIN', 'STAFF') ? '/admin' : '/'} replace />;
}
