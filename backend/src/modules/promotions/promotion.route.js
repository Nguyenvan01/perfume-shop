'use strict';

const express = require('express');
const { validate: validateRequest } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const controller = require('./promotion.controller');
const schemas = require('./promotion.validation');

const router = express.Router();

router.use(authenticate);

// Khách kiểm tra mã ở giỏ hàng. Đặt trước '/:id' để không bị hiểu là id.
router.post(
  '/validate',
  requireRole('CUSTOMER'),
  validateRequest(schemas.validateSchema),
  controller.validate
);

// ADMIN/STAFF xem danh sách; chỉ ADMIN được tạo/sửa/xoá khuyến mãi.
router.get('/', requireRole('ADMIN', 'STAFF'), validateRequest(schemas.listSchema), controller.list);
router.get(
  '/:id',
  requireRole('ADMIN', 'STAFF'),
  validateRequest(schemas.detailSchema),
  controller.detail
);

router.post('/', requireRole('ADMIN'), validateRequest(schemas.createSchema), controller.create);
router.put('/:id', requireRole('ADMIN'), validateRequest(schemas.updateSchema), controller.update);
router.patch(
  '/:id/status',
  requireRole('ADMIN'),
  validateRequest(schemas.setStatusSchema),
  controller.setStatus
);
router.delete(
  '/:id',
  requireRole('ADMIN'),
  validateRequest(schemas.detailSchema),
  controller.remove
);

module.exports = router;
