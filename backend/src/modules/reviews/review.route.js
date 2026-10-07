'use strict';

const express = require('express');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const controller = require('./review.controller');
const schemas = require('./review.validation');

const router = express.Router();

router.use(authenticate);

// Kiểm duyệt: ADMIN/STAFF xem, chỉ ADMIN ẩn/xoá.
router.get('/', requireRole('ADMIN', 'STAFF'), validate(schemas.listAllSchema), controller.listAll);

// Khách sửa đánh giá của chính mình — service kiểm tra quyền sở hữu.
router.put('/:id', requireRole('CUSTOMER'), validate(schemas.updateSchema), controller.update);

router.patch(
  '/:id/visibility',
  requireRole('ADMIN'),
  validate(schemas.visibilitySchema),
  controller.setVisibility
);
router.delete(
  '/:id',
  requireRole('ADMIN'),
  validate(schemas.detailSchema),
  controller.remove
);

module.exports = router;
