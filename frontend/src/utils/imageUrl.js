import { SERVER_ORIGIN } from '../api/baseUrl';

/**
 * Backend trả `image_url` tương đối khi dùng storage driver `local` ("/uploads/..."),
 * và URL tuyệt đối khi dùng Cloudinary. Hàm này xử lý cả hai.
 */
export function resolveImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${SERVER_ORIGIN}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
}

/** Ảnh chính của product, fallback về ảnh đầu tiên. */
export function primaryImageUrl(product) {
  const images = product?.images ?? [];
  const primary = images.find((image) => image.is_primary) ?? images[0];
  return resolveImageUrl(primary?.image_url);
}
