import { describe, expect, it, vi } from 'vitest';
import {
  DEV_FALLBACK_API_BASE_URL,
  MISSING_API_BASE_URL_MESSAGE,
  resolveApiBaseUrl,
} from './baseUrl';

describe('resolveApiBaseUrl', () => {
  it('dùng VITE_API_BASE_URL khi có, bỏ dấu / cuối', () => {
    expect(
      resolveApiBaseUrl({ VITE_API_BASE_URL: 'https://api.example.com/api/v1/', PROD: true })
    ).toBe('https://api.example.com/api/v1');
  });

  it('dev/test thiếu biến → fallback localhost', () => {
    expect(resolveApiBaseUrl({ PROD: false })).toBe(DEV_FALLBACK_API_BASE_URL);
    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: '  ', PROD: false })).toBe(
      DEV_FALLBACK_API_BASE_URL
    );
  });

  it('production thiếu biến → null + console.error, không gọi localhost', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(resolveApiBaseUrl({ PROD: true })).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining(MISSING_API_BASE_URL_MESSAGE));
  });
});
