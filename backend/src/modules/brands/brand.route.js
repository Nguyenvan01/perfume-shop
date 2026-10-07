'use strict';

const express = require('express');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate, optionalAuthenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { uploadImages } = require('../../middleware/upload.middleware');
const controller = require('./brand.controller');
const schemas = require('./brand.validation');

const router = express.Router();

// Public đọc được, nhưng nếu có token ADMIN/STAFF thì thấy cả bản ghi INACTIVE.
router.get('/', optionalAuthenticate, validate(schemas.listSchema), controller.list);
router.get('/:id', optionalAuthenticate, validate(schemas.detailSchema), controller.detail);

router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'STAFF'),
  validate(schemas.createSchema),
  controller.create
);
router.put(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'STAFF'),
  validate(schemas.updateSchema),
  controller.update
);
router.post(
  '/:id/logo',
  authenticate,
  requireRole('ADMIN', 'STAFF'),
  validate(schemas.detailSchema),
  uploadImages('files'),
  controller.uploadLogo
);
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  validate(schemas.detailSchema),
  controller.remove
);

module.exports = router;
