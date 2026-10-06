import { http, toList } from './client';

export const promotionsApi = {
  list: (params) => http.get('/promotions', { params }).then(toList),
  detail: (id) => http.get(`/promotions/${id}`).then((r) => r.data),
  create: (payload) => http.post('/promotions', payload).then((r) => r.data),
  update: (id, payload) => http.put(`/promotions/${id}`, payload).then((r) => r.data),
  setStatus: (id, status) => http.patch(`/promotions/${id}/status`, { status }).then((r) => r.data),
  remove: (id) => http.delete(`/promotions/${id}`).then((r) => r.data),
  /** Customer nhập voucher ở cart/checkout. */
  validate: (code, subtotal) =>
    http.post('/promotions/validate', { code, subtotal }).then((r) => r.data),
};
