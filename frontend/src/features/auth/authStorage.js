const ACCESS_TOKEN_KEY = 'perfume.accessToken';
const REFRESH_TOKEN_KEY = 'perfume.refreshToken';

/**
 * Token lưu ở localStorage (OD-3). Đây là nơi DUY NHẤT đọc/ghi token —
 * axios interceptor và AuthContext đều đi qua đây.
 */
export const authStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),

  setTokens({ accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};
