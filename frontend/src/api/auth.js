import { http } from './client';

export const authApi = {
  register: (payload) => http.post('/auth/register', payload).then((r) => r.data),
  login: (payload) => http.post('/auth/login', payload).then((r) => r.data),
  refresh: (refreshToken) => http.post('/auth/refresh', { refreshToken }).then((r) => r.data),
  logout: (refreshToken) => http.post('/auth/logout', { refreshToken }).then((r) => r.data),
  me: () => http.get('/auth/me').then((r) => r.data),
  updateProfile: (payload) => http.put('/auth/me', payload).then((r) => r.data),
  changePassword: (payload) => http.post('/auth/change-password', payload).then((r) => r.data),
  forgotPassword: (payload) => http.post('/auth/forgot-password', payload).then((r) => r.data),
  resetPassword: (payload) => http.post('/auth/reset-password', payload).then((r) => r.data),
};
