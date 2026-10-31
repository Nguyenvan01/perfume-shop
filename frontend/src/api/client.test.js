import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import {
  apiClient,
  ApiError,
  NETWORK_ERROR_MESSAGE,
  PAYLOAD_TOO_LARGE_MESSAGE,
  UPLOAD_NETWORK_ERROR_MESSAGE,
} from './client';

/** Thay adapter HTTP của axios để giả lập phản hồi mà không cần mạng. */
let originalAdapter;
beforeEach(() => {
  originalAdapter = apiClient.defaults.adapter;
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

function failWithoutResponse() {
  // Giống trình duyệt khi response bị chặn vì thiếu header CORS: không có `response`.
  apiClient.defaults.adapter = (config) =>
    Promise.reject(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {}));
}

const multipart = { headers: { 'Content-Type': undefined } };

describe('apiClient — lỗi không có response', () => {
  it('request FormData mất response → thông báo nhắc khả năng vượt giới hạn dung lượng', async () => {
    failWithoutResponse();
    const formData = new FormData();
    formData.append('files', new File(['x'], 'a.png', { type: 'image/png' }));

    const error = await apiClient.post('/products/1/images', formData, multipart).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toBe(UPLOAD_NETWORK_ERROR_MESSAGE);
    expect(error.message).toMatch(/giới hạn dung lượng/);
  });

  it('request JSON mất response → thông báo mất kết nối như cũ', async () => {
    failWithoutResponse();
    const error = await apiClient.post('/brands', { name: 'Dior' }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe(NETWORK_ERROR_MESSAGE);
  });
});

describe('apiClient — 413 đọc được (cùng origin)', () => {
  it('giữ thông báo payload quá lớn khi body 413 không theo envelope', async () => {
    apiClient.defaults.adapter = (config) =>
      Promise.reject(
        new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
          status: 413,
          data: 'FUNCTION_PAYLOAD_TOO_LARGE',
          headers: {},
          config,
        })
      );
    const formData = new FormData();
    formData.append('files', new File(['x'], 'a.png', { type: 'image/png' }));

    const error = await apiClient.post('/products/1/images', formData, multipart).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(413);
    expect(error.message).toBe(PAYLOAD_TOO_LARGE_MESSAGE);
  });
});
