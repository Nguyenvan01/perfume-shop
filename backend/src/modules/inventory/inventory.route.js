'use strict';

const express = require('express');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const controller = require('./inventory.controller');
const schemas = require('./inventory.validation');

const router = express.Router();

// Toàn bộ module kho là nội bộ: ADMIN và STAFF.
router.use(authenticate, requireRole('ADMIN', 'STAFF'));

router.get('/', validate(schemas.listSchema), controller.list);
router.get('/summary', controller.summary);
router.get('/low-stock', validate(schemas.listSchema), controller.lowStock);
router.get('/transactions', validate(schemas.transactionsSchema), controller.transactions);

router.post('/import', validate(schemas.movementSchema), controller.importStock);
router.post('/export', validate(schemas.movementSchema), controller.exportStock);

// Điều chỉnh kho ghi đè số liệu thật nên chỉ ADMIN được làm.
router.post(
  '/adjustment',
  requireRole('ADMIN'),
  validate(schemas.adjustmentSchema),
  controller.adjust
);

module.exports = router;
