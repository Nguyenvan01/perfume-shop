import { http, toList } from './client';
import { splitIntoUploadBatches } from '../utils/uploadBatches';

export const brandsApi = {
  list: (params) => http.get('/brands', { params }).then(toList),
  detail: (id) => http.get(`/brands/${id}`).then((r) => r.data),
  create: (payload) => http.post('/brands', payload).then((r) => r.data),
  update: (id, payload) => http.put(`/brands/${id}`, payload).then((r) => r.data),
  remove: (id) => http.delete(`/brands/${id}`).then((r) => r.data),
};

export const categoriesApi = {
  list: (params) => http.get('/categories', { params }).then(toList),
  detail: (id) => http.get(`/categories/${id}`).then((r) => r.data),
  create: (payload) => http.post('/categories', payload).then((r) => r.data),
  update: (id, payload) => http.put(`/categories/${id}`, payload).then((r) => r.data),
  remove: (id) => http.delete(`/categories/${id}`).then((r) => r.data),
};

export const productsApi = {
  list: (params) => http.get('/products', { params }).then(toList),
  /** `idOrSlug`: backend nhận cả id số và slug (§2.6). */
  detail: (idOrSlug) => http.get(`/products/${idOrSlug}`).then((r) => r.data),
  create: (payload) => http.post('/products', payload).then((r) => r.data),
  update: (id, payload) => http.put(`/products/${id}`, payload).then((r) => r.data),
  remove: (id) => http.delete(`/products/${id}`).then((r) => r.data),
};

export const variantsApi = {
  listByProduct: (productId) => http.get(`/products/${productId}/variants`).then((r) => r.data),
  create: (productId, payload) =>
    http.post(`/products/${productId}/variants`, payload).then((r) => r.data),
  update: (id, payload) => http.put(`/variants/${id}`, payload).then((r) => r.data),
  remove: (id) => http.delete(`/variants/${id}`).then((r) => r.data),
};

export const productImagesApi = {
  /**
   * `files`: File[] — gửi multipart, không set Content-Type để browser tự thêm boundary.
   * Chia thành nhiều request tuần tự để mỗi body ≤ giới hạn 4.5MB của Vercel.
   * Backend trả danh sách ảnh đầy đủ của product → kết quả là response của batch cuối.
   */
  upload: async (productId, files, isPrimary = false) => {
    let images = [];
    for (const [index, batch] of splitIntoUploadBatches(files).entries()) {
      const formData = new FormData();
      batch.forEach((file) => formData.append('files', file));
      if (isPrimary && index === 0) formData.append('is_primary', 'true');
      images = await http
        .post(`/products/${productId}/images`, formData, { headers: { 'Content-Type': undefined } })
        .then((r) => r.data);
    }
    return images;
  },
  setPrimary: (productId, imageId) =>
    http.patch(`/products/${productId}/images/${imageId}/primary`).then((r) => r.data),
  remove: (productId, imageId) =>
    http.delete(`/products/${productId}/images/${imageId}`).then((r) => r.data),
};
