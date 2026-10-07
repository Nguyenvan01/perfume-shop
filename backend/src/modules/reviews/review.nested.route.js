'use strict';

const express = require('express');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const controller = require('./review.controller');
const schemas = require('./review.validation');

// Lồng dưới /products/:productId/reviews
const router = express.Router({ mergeParams: true });

router.get('/', validate(schemas.listByProductSchema), controller.listByProduct);

// Khách kiểm tra mình có được đánh giá sản phẩm này không.
router.get(
  '/eligibility',
  authenticate,
  requireRole('CUSTOMER'),
  validate(schemas.eligibilitySchema),
  controller.eligibility
);

router.post(
  '/',
  authenticate,
  requireRole('CUSTOMER'),
  validate(schemas.createSchema),
  controller.create
);

module.exports = router;
