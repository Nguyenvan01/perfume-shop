'use strict';

const express = require('express');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const controller = require('./report.controller');
const schemas = require('./report.validation');

const router = express.Router();

router.use(authenticate, requireRole('ADMIN', 'STAFF'));

router.get('/dashboard', validate(schemas.rangeSchema), controller.dashboard);
router.get('/revenue', validate(schemas.revenueSchema), controller.revenue);
router.get('/top-products', validate(schemas.limitSchema), controller.topProducts);
router.get('/revenue-by-brand', validate(schemas.rangeSchema), controller.revenueByBrand);
router.get('/order-status', validate(schemas.rangeSchema), controller.orderStatus);
router.get('/low-stock', validate(schemas.limitSchema), controller.lowStock);

module.exports = router;
