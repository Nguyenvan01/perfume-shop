'use strict';

const express = require('express');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const controller = require('./customer.controller');
const schemas = require('./customer.validation');

const router = express.Router();

router.use(authenticate, requireRole('ADMIN', 'STAFF'));

router.get('/', validate(schemas.listSchema), controller.list);
router.get('/:id', validate(schemas.detailSchema), controller.detail);
router.get('/:id/orders', validate(schemas.ordersSchema), controller.listOrders);

// Khóa/mở khóa khách là hành động nhạy cảm → chỉ ADMIN.
router.patch(
  '/:id/status',
  requireRole('ADMIN'),
  validate(schemas.setStatusSchema),
  controller.setStatus
);

module.exports = router;
