import { http } from './client';

export const cartApi = {
  get: () => http.get('/cart').then((r) => r.data),
  addItem: (payload) => http.post('/cart/items', payload).then((r) => r.data),
  updateItem: (itemId, quantity) =>
    http.put(`/cart/items/${itemId}`, { quantity }).then((r) => r.data),
  removeItem: (itemId) => http.delete(`/cart/items/${itemId}`).then((r) => r.data),
  clear: () => http.delete('/cart').then((r) => r.data),
  /** Tính subtotal/discount/shipping/total + cảnh báo stock trước khi checkout. */
  preview: (payload) => http.post('/cart/preview', payload).then((r) => r.data),
};
