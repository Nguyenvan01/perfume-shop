'use strict';

const express = require('express');
const { validate: validateRequest } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const controller = require('./promotion.controller');
const schemas = require('./promotion.validation');

const router = express.Router();

// W5 chỉ mở endpoint kiểm tra mã cho khách; CRUD khuyến mãi thuộc W6.
router.post(
  '/validate',
  authenticate,
  requireRole('CUSTOMER'),
  validateRequest(schemas.validateSchema),
  controller.validate
);

module.exports = router;
