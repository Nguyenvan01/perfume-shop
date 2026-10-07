'use strict';

const express = require('express');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const controller = require('./order.controller');
const schemas = require('./order.validation');

const router = express.Router();

router.use(authenticate);

// ─── Khách hàng ───
router.post('/', requireRole('CUSTOMER'), validate(schemas.createSchema), controller.create);
router.get('/my', requireRole('CUSTOMER'), validate(schemas.myOrdersSchema), controller.myOrders);

// ─── Admin / Staff ───
// Đặt trước '/:id' để '/my' không bị hiểu thành id.
router.get('/', requireRole('ADMIN', 'STAFF'), validate(schemas.listSchema), controller.list);

// Khách xem được đơn của chính mình; service kiểm tra quyền sở hữu.
router.get('/:id', validate(schemas.detailSchema), controller.detail);

// Khách hủy đơn PENDING, nhân viên hủy đơn PENDING/CONFIRMED — service phân biệt.
router.patch('/:id/cancel', validate(schemas.cancelSchema), controller.cancel);

router.patch(
  '/:id/status',
  requireRole('ADMIN', 'STAFF'),
  validate(schemas.changeStatusSchema),
  controller.changeStatus
);
router.patch(
  '/:id/return',
  requireRole('ADMIN'),
  validate(schemas.returnSchema),
  controller.processReturn
);
router.patch(
  '/:id/payment',
  requireRole('ADMIN', 'STAFF'),
  validate(schemas.paymentSchema),
  controller.updatePayment
);
router.get(
  '/:id/invoice',
  requireRole('ADMIN', 'STAFF'),
  validate(schemas.detailSchema),
  controller.invoice
);

module.exports = router;
