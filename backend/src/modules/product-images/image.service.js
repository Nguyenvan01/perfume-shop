'use strict';

const AppError = require('../../utils/AppError');
const storage = require('../../utils/storage');
const repo = require('./image.repository');

const MAX_IMAGES_PER_PRODUCT = 10;

async function assertProduct(product_id) {
  const product = await repo.findProduct(product_id);
  if (!product) throw AppError.notFound('Product not found');
  return product;
}

const listByProduct = async (product_id) => {
  await assertProduct(product_id);
  return repo.findByProduct(product_id);
};

/**
 * Upload nhiều ảnh. Ảnh đầu tiên của product tự thành ảnh chính để trang khách
 * luôn có ảnh hiển thị.
 */
async function upload(product_id, files, { isPrimary = false } = {}) {
  await assertProduct(product_id);

  if (!files?.length) throw AppError.badRequest('No file uploaded. Use field "files"');

  const existingCount = await repo.countByProduct(product_id);
  if (existingCount + files.length > MAX_IMAGES_PER_PRODUCT) {
    throw AppError.badRequest(
      `A product can have at most ${MAX_IMAGES_PER_PRODUCT} images (currently ${existingCount})`
    );
  }

  const uploaded = [];
  try {
    for (const [index, file] of files.entries()) {
      const result = await storage.upload(file.buffer, {
        filename: file.originalname,
        mimetype: file.mimetype,
        folder: 'products',
      });
      uploaded.push({
        product_id,
        image_url: result.url,
        public_id: result.public_id,
        sort_order: existingCount + index,
        is_primary: false,
      });
    }
  } catch (error) {
    // Upload giữa chừng thất bại → dọn file đã lên để không để lại rác ở storage.
    await Promise.all(uploaded.map((row) => storage.destroy(row.public_id).catch(() => {})));
    throw new AppError(502, `Upload failed: ${error.message}`);
  }

  await repo.createMany(uploaded);

  const images = await repo.findByProduct(product_id);
  const shouldSetPrimary = isPrimary || existingCount === 0;
  if (shouldSetPrimary && images.length > 0) {
    const target = images.find((image) => image.image_url === uploaded[0].image_url) ?? images[0];
    await repo.setPrimary(product_id, target.id);
    return repo.findByProduct(product_id);
  }

  return images;
}

async function setPrimary(product_id, imageId) {
  await assertProduct(product_id);

  const image = await repo.findById(imageId);
  if (!image || image.product_id !== product_id) throw AppError.notFound('Image not found');

  await repo.setPrimary(product_id, imageId);
  return repo.findByProduct(product_id);
}

async function remove(product_id, imageId) {
  await assertProduct(product_id);

  const image = await repo.findById(imageId);
  if (!image || image.product_id !== product_id) throw AppError.notFound('Image not found');

  await repo.remove(imageId);
  await storage.destroy(image.public_id).catch(() => {});

  // Xóa ảnh chính thì đẩy ảnh còn lại lên làm ảnh chính.
  if (image.is_primary) await repo.promoteFirstAsPrimary(product_id);
}

module.exports = { listByProduct, upload, setPrimary, remove, MAX_IMAGES_PER_PRODUCT };
