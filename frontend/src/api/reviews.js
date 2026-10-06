import { http, toList } from './client';

export const reviewsApi = {
  listByProduct: (productId, params) =>
    http.get(`/products/${productId}/reviews`, { params }).then(toList),
  create: (productId, payload) =>
    http.post(`/products/${productId}/reviews`, payload).then((r) => r.data),
  update: (id, payload) => http.put(`/reviews/${id}`, payload).then((r) => r.data),

  // Admin
  list: (params) => http.get('/reviews', { params }).then(toList),
  setVisibility: (id, isHidden) =>
    http.patch(`/reviews/${id}/visibility`, { is_hidden: isHidden }).then((r) => r.data),
  remove: (id) => http.delete(`/reviews/${id}`).then((r) => r.data),
};
