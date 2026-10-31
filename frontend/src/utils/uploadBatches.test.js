import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BATCH_BYTES, splitIntoUploadBatches } from './uploadBatches';

const MB = 1024 * 1024;
const file = (name, sizeMb) => ({ name, size: sizeMb * MB });

describe('splitIntoUploadBatches', () => {
  it('gộp các file nhỏ vào cùng một batch khi tổng ≤ giới hạn', () => {
    const files = [file('a', 1), file('b', 1), file('c', 1)];
    expect(splitIntoUploadBatches(files)).toEqual([files]);
  });

  it('5 ảnh × 2MB → mỗi batch ≤ 4MB, giữ nguyên thứ tự', () => {
    const files = ['a', 'b', 'c', 'd', 'e'].map((name) => file(name, 2));
    const batches = splitIntoUploadBatches(files);

    expect(batches.map((batch) => batch.map((f) => f.name))).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e'],
    ]);
    batches.forEach((batch) => {
      const total = batch.reduce((sum, f) => sum + f.size, 0);
      expect(total).toBeLessThanOrEqual(MAX_UPLOAD_BATCH_BYTES);
    });
  });

  it('file lớn hơn giới hạn đi riêng một batch', () => {
    const files = [file('a', 1), file('big', 5), file('b', 1)];
    expect(splitIntoUploadBatches(files).map((batch) => batch.map((f) => f.name))).toEqual([
      ['a'],
      ['big'],
      ['b'],
    ]);
  });

  it('không có file → không có batch', () => {
    expect(splitIntoUploadBatches([])).toEqual([]);
  });
});
