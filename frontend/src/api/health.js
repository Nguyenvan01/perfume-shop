import { http } from './client';

export const healthApi = {
  check: () => http.get('/health').then((r) => r.data),
};
