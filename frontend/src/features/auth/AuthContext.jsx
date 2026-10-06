import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../../api/auth';
import { setUnauthorizedHandler } from '../../api/client';
import { authStorage } from './authStorage';
import { ROLES } from '../../utils/constants';

const AuthContext = createContext(null);

/**
 * Nguồn sự thật duy nhất về user đang đăng nhập ở frontend.
 * W1: hydrate từ token có sẵn + logout. W2 bổ sung login/register mutation.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isHydrating, setIsHydrating] = useState(Boolean(authStorage.getAccessToken()));

  const clearSession = useCallback(() => {
    authStorage.clear();
    setUser(null);
  }, []);

  // Refresh token hết hạn → axios interceptor gọi về đây để dọn session.
  useEffect(() => {
    setUnauthorizedHandler(() => clearSession());
  }, [clearSession]);

  // Có token sẵn trong localStorage (F5 lại trang) → lấy lại profile.
  useEffect(() => {
    if (!authStorage.getAccessToken()) {
      setIsHydrating(false);
      return;
    }
    let cancelled = false;
    authApi
      .me()
      .then((data) => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {
        if (!cancelled) clearSession();
      })
      .finally(() => {
        if (!cancelled) setIsHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const login = useCallback(async (credentials) => {
    const data = await authApi.login(credentials);
    authStorage.setTokens(data);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authApi.register(payload);
    authStorage.setTokens(data);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = authStorage.getRefreshToken();
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // Logout phía server thất bại cũng phải dọn session phía client.
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo(() => {
    const roles = user?.roles ?? [];
    return {
      user,
      roles,
      permissions: user?.permissions ?? [],
      isAuthenticated: Boolean(user),
      isHydrating,
      isAdmin: roles.includes(ROLES.ADMIN),
      isStaff: roles.includes(ROLES.STAFF),
      isCustomer: roles.includes(ROLES.CUSTOMER),
      /** Guard frontend chỉ là UX — backend vẫn check lại (CLAUDE.md §3). */
      hasRole: (...allowed) => allowed.some((role) => roles.includes(role)),
      hasPermission: (code) => (user?.permissions ?? []).includes(code),
      login,
      register,
      logout,
      setUser,
    };
  }, [user, isHydrating, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
