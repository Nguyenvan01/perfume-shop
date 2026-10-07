'use strict';

const express = require('express');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate, optionalAuthenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const controller = require('./category.controller');
const schemas = require('./category.validation');

const router = express.Router();

router.get('/', optionalAuthenticate, validate(schemas.listSchema), controller.list);
router.get('/:id', optionalAuthenticate, validate(schemas.detailSchema), controller.detail);

router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'STAFF'),
  validate(schemas.createSchema),
  controller.create
);
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
