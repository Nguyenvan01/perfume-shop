/**
 * Vercel Serverless Function nhận body tối đa ~4.5MB/request. Backend cho phép 5 ảnh
 * × 2MB = 10MB/request, nên frontend phải chia file thành nhiều request nhỏ hơn.
 * Chừa ~0.5MB cho phần multipart boundary/header.
 */
export const MAX_UPLOAD_BATCH_BYTES = 4 * 1024 * 1024;

/**
 * Chia `files` (giữ thứ tự) thành các batch có tổng `size` ≤ `maxBytes`.
 * File lẻ lớn hơn `maxBytes` vẫn đi riêng một batch (để backend trả lỗi rõ ràng).
 */
export function splitIntoUploadBatches(files, maxBytes = MAX_UPLOAD_BATCH_BYTES) {
  const batches = [];
  let current = [];
  let currentBytes = 0;

  files.forEach((file) => {
    const size = file?.size ?? 0;
    if (current.length > 0 && currentBytes + size > maxBytes) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(file);
    currentBytes += size;
  });

  if (current.length > 0) batches.push(current);
  return batches;
}
