import { http, toList } from './client';

export const inventoryApi = {
  list: (params) => http.get('/inventory', { params }).then(toList),
  summary: () => http.get('/inventory/summary').then((r) => r.data),
  lowStock: (params) => http.get('/inventory/low-stock', { params }).then(toList),
  importStock: (payload) => http.post('/inventory/import', payload).then((r) => r.data),
  exportStock: (payload) => http.post('/inventory/export', payload).then((r) => r.data),
  adjust: (payload) => http.post('/inventory/adjustment', payload).then((r) => r.data),
  transactions: (params) => http.get('/inventory/transactions', { params }).then(toList),
};
