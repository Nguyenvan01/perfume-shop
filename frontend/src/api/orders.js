import { http, toList } from './client';

export const ordersApi = {
  // Customer
  create: (payload) => http.post('/orders', payload).then((r) => r.data),
  myOrders: (params) => http.get('/orders/my', { params }).then(toList),
  detail: (id) => http.get(`/orders/${id}`).then((r) => r.data),
  cancel: (id, reason) => http.patch(`/orders/${id}/cancel`, { reason }).then((r) => r.data),

  // Admin / Staff
  list: (params) => http.get('/orders', { params }).then(toList),
  updateStatus: (id, status, note) =>
    http.patch(`/orders/${id}/status`, { status, note }).then((r) => r.data),
  processReturn: (id, reason) => http.patch(`/orders/${id}/return`, { reason }).then((r) => r.data),
  updatePayment: (id, status) => http.patch(`/orders/${id}/payment`, { status }).then((r) => r.data),
  invoice: (id) => http.get(`/orders/${id}/invoice`).then((r) => r.data),
};
