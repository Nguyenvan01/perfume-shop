import { http } from './client';

/** Mọi endpoint nhận { range, from, to } — xem implementation_plan.md §2.15. */
export const reportsApi = {
  dashboard: (params) => http.get('/reports/dashboard', { params }).then((r) => r.data),
  revenue: (params) => http.get('/reports/revenue', { params }).then((r) => r.data),
  topProducts: (params) => http.get('/reports/top-products', { params }).then((r) => r.data),
  revenueByBrand: (params) => http.get('/reports/revenue-by-brand', { params }).then((r) => r.data),
  orderStatus: (params) => http.get('/reports/order-status', { params }).then((r) => r.data),
  lowStock: (params) => http.get('/reports/low-stock', { params }).then((r) => r.data),
};
