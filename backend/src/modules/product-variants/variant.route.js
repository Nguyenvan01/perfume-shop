'use strict';

const express = require('express');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate, optionalAuthenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const controller = require('./variant.controller');
const schemas = require('./variant.validation');

const router = express.Router();

router.get('/:id', optionalAuthenticate, validate(schemas.detailSchema), controller.detail);
router.put(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'STAFF'),
  validate(schemas.updateSchema),
  controller.update
);
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  validate(schemas.detailSchema),
  controller.remove
);

module.exports = router;
