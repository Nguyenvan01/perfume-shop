import { describe, expect, it } from 'vitest';
import { resolveImageUrl, primaryImageUrl } from './imageUrl';

describe('resolveImageUrl', () => {
  it('ghép origin server cho đường dẫn local của storage driver local', () => {
    expect(resolveImageUrl('/uploads/products/a.png')).toBe(
      'http://localhost:4000/uploads/products/a.png'
    );
  });

  it('giữ nguyên URL tuyệt đối (Cloudinary)', () => {
    const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg';
    expect(resolveImageUrl(cloudinaryUrl)).toBe(cloudinaryUrl);
  });

  it('trả null khi không có ảnh', () => {
    expect(resolveImageUrl(null)).toBeNull();
    expect(resolveImageUrl('')).toBeNull();
  });
});

describe('primaryImageUrl', () => {
  it('ưu tiên ảnh is_primary dù không nằm đầu mảng', () => {
    const product = {
      images: [
        { id: 1, image_url: '/uploads/a.png', is_primary: false },
        { id: 2, image_url: '/uploads/b.png', is_primary: true },
      ],
    };
    expect(primaryImageUrl(product)).toContain('/uploads/b.png');
  });

  it('không có ảnh chính thì lấy ảnh đầu tiên', () => {
    const product = { images: [{ id: 1, image_url: '/uploads/a.png', is_primary: false }] };
    expect(primaryImageUrl(product)).toContain('/uploads/a.png');
  });

  it('product không có ảnh → null', () => {
    expect(primaryImageUrl({ images: [] })).toBeNull();
    expect(primaryImageUrl({})).toBeNull();
    expect(primaryImageUrl(null)).toBeNull();
  });
});
