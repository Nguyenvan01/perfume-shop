'use strict';

const express = require('express');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate, optionalAuthenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { uploadImages } = require('../../middleware/upload.middleware');
const controller = require('./image.controller');
const schemas = require('./image.validation');

const router = express.Router({ mergeParams: true });

router.get('/', optionalAuthenticate, validate(schemas.listSchema), controller.listByProduct);

router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'STAFF'),
  // multer phải chạy trước validate: body multipart chưa được parse trước đó.
  uploadImages('files'),
  validate(schemas.uploadSchema),
  controller.upload
);

router.patch(
  '/:imageId/primary',
  authenticate,
  requireRole('ADMIN', 'STAFF'),
  validate(schemas.imageParamSchema),
  controller.setPrimary
);

router.delete(
  '/:imageId',
  authenticate,
  requireRole('ADMIN', 'STAFF'),
  validate(schemas.imageParamSchema),
  controller.remove
);

module.exports = router;
