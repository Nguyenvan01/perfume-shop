import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import * as authContext from '../features/auth/AuthContext';

/** Giả lập useAuth để test guard độc lập với API. */
function mockAuth({ isAuthenticated = false, roles = [], isHydrating = false } = {}) {
  vi.spyOn(authContext, 'useAuth').mockReturnValue({
    isAuthenticated,
    isHydrating,
    roles,
    hasRole: (...allowed) => allowed.some((role) => roles.includes(role)),
  });
}

function renderAt(path, element) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>trang dang nhap</div>} />
        <Route path={path} element={element}>
          <Route index element={<div>noi dung duoc bao ve</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('chưa đăng nhập → chuyển về /login', () => {
    mockAuth({ isAuthenticated: false });
    renderAt('/admin', <ProtectedRoute allowedRoles={['ADMIN']} />);
    expect(screen.getByText('trang dang nhap')).toBeInTheDocument();
  });

  it('đã đăng nhập đúng role → render nội dung', () => {
    mockAuth({ isAuthenticated: true, roles: ['ADMIN'] });
    renderAt('/admin', <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']} />);
    expect(screen.getByText('noi dung duoc bao ve')).toBeInTheDocument();
  });

  it('CUSTOMER vào route admin → 403, không render nội dung', () => {
    mockAuth({ isAuthenticated: true, roles: ['CUSTOMER'] });
    renderAt('/admin', <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']} />);
    expect(screen.getByText('403')).toBeInTheDocument();
    expect(screen.queryByText('noi dung duoc bao ve')).not.toBeInTheDocument();
  });

  it('STAFF vào route chỉ dành cho ADMIN → 403 (khớp TC09 ở backend)', () => {
    mockAuth({ isAuthenticated: true, roles: ['STAFF'] });
    renderAt('/admin/users', <ProtectedRoute allowedRoles={['ADMIN']} />);
    expect(screen.getByText('403')).toBeInTheDocument();
  });

  it('đang hydrate session → không redirect sớm', () => {
    mockAuth({ isAuthenticated: false, isHydrating: true });
    renderAt('/admin', <ProtectedRoute allowedRoles={['ADMIN']} />);
    expect(screen.queryByText('trang dang nhap')).not.toBeInTheDocument();
  });
});
