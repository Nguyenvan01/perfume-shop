import { http, toList } from './client';

export const reviewsApi = {
  /** Công khai: danh sách đánh giá + thống kê điểm của một sản phẩm. */
  listByProduct: (productId, params) =>
    http.get(`/products/${productId}/reviews`, { params }).then((response) => ({
      items: response.data ?? [],
      meta: response.meta ?? null,
      // Backend gửi kèm summary trong cùng response để trang sản phẩm chỉ cần 1 request.
      summary: response.summary ?? null,
    })),

  /** Khách: mình có được đánh giá sản phẩm này không, và vì sao không. */
  eligibility: (productId) =>
    http.get(`/products/${productId}/reviews/eligibility`).then((r) => r.data),

  create: (productId, payload) =>
    http.post(`/products/${productId}/reviews`, payload).then((r) => r.data),

  update: (id, payload) => http.put(`/reviews/${id}`, payload).then((r) => r.data),

  // Kiểm duyệt
  list: (params) => http.get('/reviews', { params }).then(toList),
  setVisibility: (id, isHidden) =>
    http.patch(`/reviews/${id}/visibility`, { is_hidden: isHidden }).then((r) => r.data),
  remove: (id) => http.delete(`/reviews/${id}`).then((r) => r.data),
};
