'use strict';

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const env = require('../../config/env');

const UPLOAD_ROOT = path.resolve(__dirname, '../../..', env.UPLOAD_DIR);

/** Lưu file xuống đĩa và serve qua express.static('/uploads'). Dùng cho dev (OD-5). */
async function upload(buffer, { filename, folder = 'products', mimetype }) {
  const dir = path.join(UPLOAD_ROOT, folder);
  await fs.mkdir(dir, { recursive: true });

  const ext = path.extname(filename) || `.${(mimetype || '').split('/')[1] || 'bin'}`;
  // Tên ngẫu nhiên: tránh ghi đè và tránh path traversal từ tên file người dùng gửi lên.
  const storedName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  const publicId = `${folder}/${storedName}`;

  await fs.writeFile(path.join(dir, storedName), buffer);

  return { url: `/uploads/${publicId}`, public_id: publicId };
}

async function destroy(publicId) {
  if (!publicId) return;

  // Chặn publicId bịa ra để xóa file ngoài thư mục upload.
  const target = path.resolve(UPLOAD_ROOT, publicId);
  if (!target.startsWith(UPLOAD_ROOT + path.sep)) return;

  await fs.rm(target, { force: true });
}

module.exports = { upload, destroy, name: 'local' };
