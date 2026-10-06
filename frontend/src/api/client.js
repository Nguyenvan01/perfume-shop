import axios from 'axios';
import { authStorage } from '../features/auth/authStorage';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';

/** Lỗi đã được chuẩn hoá từ envelope backend (implementation_plan.md §2). */
export class ApiError extends Error {
  constructor({ message, status, errors }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors ?? [];
  }

  /** Map errors[] của backend thành { field: message } để nạp vào AntD Form. */
  get fieldErrors() {
    return this.errors.reduce((acc, item) => {
      if (item.field) acc[item.field] = item.message;
      return acc;
    }, {});
  }
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = authStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let onUnauthorized = null;
/** AuthContext đăng ký callback này để logout + redirect khi refresh thất bại. */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

// Gom nhiều request 401 đồng thời vào 1 lần refresh duy nhất.
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = authStorage.getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');

  // Dùng axios gốc để không rơi vào interceptor này lần nữa (vòng lặp vô tận).
  const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
  const tokens = data?.data ?? {};
  authStorage.setTokens(tokens);
  return tokens.accessToken;
}

apiClient.interceptors.response.use(
  // Mở envelope: component chỉ thấy `data`, `meta` gắn kèm khi là list response.
  (response) => {
    const body = response.data;
    if (body && typeof body === 'object' && 'success' in body) {
      return { data: body.data, meta: body.meta, message: body.message };
    }
    return { data: body };
  },
  async (error) => {
    const { response, config } = error;

    if (!response) {
      return Promise.reject(
        new ApiError({ message: 'Không kết nối được tới server. Vui lòng thử lại.', status: 0 })
      );
    }

    const isAuthEndpoint = config?.url?.includes('/auth/login') || config?.url?.includes('/auth/refresh');

    if (response.status === 401 && !config._retried && !isAuthEndpoint) {
      config._retried = true;
      try {
        refreshPromise = refreshPromise || refreshAccessToken();
        const newToken = await refreshPromise;
        refreshPromise = null;
        config.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(config);
      } catch {
        refreshPromise = null;
        authStorage.clear();
        if (onUnauthorized) onUnauthorized();
      }
    }

    const body = response.data || {};
    return Promise.reject(
      new ApiError({
        message: body.message || 'Đã có lỗi xảy ra',
        status: response.status,
        errors: body.errors,
      })
    );
  }
);

/** Helper gọn cho các module api: trả thẳng `data`, hoặc `{ items, meta }` cho list. */
export const http = {
  get: (url, config) => apiClient.get(url, config),
  post: (url, body, config) => apiClient.post(url, body, config),
  put: (url, body, config) => apiClient.put(url, body, config),
  patch: (url, body, config) => apiClient.patch(url, body, config),
  delete: (url, config) => apiClient.delete(url, config),
};

/** Chuẩn hoá list response về { items, meta } đúng contract §2. */
export function toList(response) {
  return { items: response.data ?? [], meta: response.meta ?? null };
}
