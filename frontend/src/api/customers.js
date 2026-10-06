import { http, toList } from './client';

export const customersApi = {
  list: (params) => http.get('/customers', { params }).then(toList),
  detail: (id) => http.get(`/customers/${id}`).then((r) => r.data),
  orders: (id, params) => http.get(`/customers/${id}/orders`, { params }).then(toList),
  setStatus: (id, status) => http.patch(`/customers/${id}/status`, { status }).then((r) => r.data),
};
