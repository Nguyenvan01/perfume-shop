import { describe, expect, it, vi } from 'vitest';
import { http } from './client';
import { productImagesApi } from './catalog';

const MB = 1024 * 1024;
const file = (name, size) => {
  const f = new File(['x'], name, { type: 'image/png' });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('productImagesApi.upload — onBatchUploaded', () => {
  it('gọi callback sau mỗi batch thành công, với đúng các file của batch', async () => {
    const a = file('a.png', 2 * MB);
    const b = file('b.png', 2 * MB);
    const c = file('c.png', 2 * MB);
    const post = vi
      .spyOn(http, 'post')
      .mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }] })
      .mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }, { id: 3 }] });
    const onBatchUploaded = vi.fn();

    const images = await productImagesApi.upload(7, [a, b, c], { onBatchUploaded });

    expect(post).toHaveBeenCalledTimes(2);
    expect(onBatchUploaded).toHaveBeenNthCalledWith(1, [a, b], [{ id: 1 }, { id: 2 }]);
    expect(onBatchUploaded).toHaveBeenNthCalledWith(2, [c], images);
    expect(images).toHaveLength(3);
  });

  it('batch 2 lỗi → chỉ batch 1 được báo đã lưu, lỗi được ném ra cho caller', async () => {
    const a = file('a.png', 3 * MB);
    const b = file('b.png', 3 * MB);
    const failure = new Error('boom');
    vi.spyOn(http, 'post')
      .mockResolvedValueOnce({ data: [{ id: 1 }] })
      .mockRejectedValueOnce(failure);
    const onBatchUploaded = vi.fn();

    await expect(productImagesApi.upload(7, [a, b], { onBatchUploaded })).rejects.toBe(failure);
    expect(onBatchUploaded).toHaveBeenCalledTimes(1);
    expect(onBatchUploaded).toHaveBeenCalledWith([a], [{ id: 1 }]);
  });

  it('isPrimary chỉ gắn vào batch đầu', async () => {
    const post = vi.spyOn(http, 'post').mockResolvedValue({ data: [] });

    await productImagesApi.upload(7, [file('a.png', 3 * MB), file('b.png', 3 * MB)], {
      isPrimary: true,
    });

    expect(post.mock.calls[0][1].get('is_primary')).toBe('true');
    expect(post.mock.calls[1][1].get('is_primary')).toBeNull();
  });
});
