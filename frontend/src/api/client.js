import axios from 'axios';
import { authStorage } from '../features/auth/authStorage';
import { API_BASE_URL, MISSING_API_BASE_URL_MESSAGE } from './baseUrl';

const BASE_URL = API_BASE_URL;

/** Vercel chặn body > 4.5MB trước khi tới backend, trả 413 không theo envelope. */
export const PAYLOAD_TOO_LARGE_MESSAGE =
  'Dữ liệu gửi lên quá lớn. Vui lòng gửi ít file hơn hoặc file nhỏ hơn.';

export const NETWORK_ERROR_MESSAGE = 'Không kết nối được tới server. Vui lòng thử lại.';

/**
 * Khi frontend và backend khác origin, 413 của Vercel edge KHÔNG có header CORS → trình
 * duyệt chặn response, axios chỉ thấy "Network Error" (không có `error.response`).
 * Request upload file (FormData) mà mất response thì rất có thể là do vượt giới hạn dung lượng.
 */
export const UPLOAD_NETWORK_ERROR_MESSAGE =
  'Không gửi được file lên server. Có thể dữ liệu vượt giới hạn dung lượng mỗi lần gửi ' +
  'hoặc mất kết nối. Vui lòng thử lại với ít file hơn hoặc file nhỏ hơn.';

function isFormDataBody(config) {
  return typeof FormData !== 'undefined' && config?.data instanceof FormData;
}

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
  // Production build thiếu VITE_API_BASE_URL: báo lỗi cấu hình rõ ràng thay vì gọi nhầm chỗ.
  if (!BASE_URL) {
    throw new ApiError({ message: MISSING_API_BASE_URL_MESSAGE, status: 0 });
  }
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
    if (error instanceof ApiError) return Promise.reject(error);

    const { response, config } = error;

    if (!response) {
      const message = isFormDataBody(config) ? UPLOAD_NETWORK_ERROR_MESSAGE : NETWORK_ERROR_MESSAGE;
      return Promise.reject(new ApiError({ message, status: 0 }));
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
    // Cùng origin (hoặc proxy có CORS) thì vẫn đọc được 413 thật từ Vercel.
    const fallbackMessage =
      response.status === 413 ? PAYLOAD_TOO_LARGE_MESSAGE : 'Đã có lỗi xảy ra';
    return Promise.reject(
      new ApiError({
        message: body.message || fallbackMessage,
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
