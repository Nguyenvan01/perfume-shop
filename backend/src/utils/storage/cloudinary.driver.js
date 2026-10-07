'use strict';

const { v2: cloudinary } = require('cloudinary');
const env = require('../../config/env');

let configured = false;

function configure() {
  if (configured) return;

  const missing = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].filter(
    (key) => !env[key]
  );
  if (missing.length > 0) {
    throw new Error(`STORAGE_DRIVER=cloudinary but missing env: ${missing.join(', ')}`);
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

function upload(buffer, { folder = 'products' } = {}) {
  configure();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `perfume-shop/${folder}`, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        return resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

async function destroy(publicId) {
  if (!publicId) return;
  configure();
  await cloudinary.uploader.destroy(publicId);
}

module.exports = { upload, destroy, name: 'cloudinary' };
