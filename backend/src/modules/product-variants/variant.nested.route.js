'use strict';

const express = require('express');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate, optionalAuthenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const controller = require('./variant.controller');
const schemas = require('./variant.validation');

// mergeParams để lấy được :productId từ router cha.
const router = express.Router({ mergeParams: true });

router.get('/', optionalAuthenticate, validate(schemas.listSchema), controller.listByProduct);
router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'STAFF'),
  validate(schemas.createSchema),
  controller.create
);

module.exports = router;
