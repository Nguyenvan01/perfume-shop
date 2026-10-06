import { http, toList } from './client';

export const usersApi = {
  list: (params) => http.get('/users', { params }).then(toList),
  detail: (id) => http.get(`/users/${id}`).then((r) => r.data),
  create: (payload) => http.post('/users', payload).then((r) => r.data),
  update: (id, payload) => http.put(`/users/${id}`, payload).then((r) => r.data),
  setStatus: (id, status) => http.patch(`/users/${id}/status`, { status }).then((r) => r.data),
  resetPassword: (id, newPassword) =>
    http.patch(`/users/${id}/reset-password`, { new_password: newPassword }).then((r) => r.data),
  remove: (id) => http.delete(`/users/${id}`).then((r) => r.data),
};

export const rolesApi = {
  list: () => http.get('/roles').then((r) => r.data),
  create: (payload) => http.post('/roles', payload).then((r) => r.data),
  update: (id, payload) => http.put(`/roles/${id}`, payload).then((r) => r.data),
  remove: (id) => http.delete(`/roles/${id}`).then((r) => r.data),
};

export const permissionsApi = {
  list: () => http.get('/permissions').then((r) => r.data),
};
