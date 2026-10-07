'use strict';

const express = require('express');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate, optionalAuthenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const controller = require('./product.controller');
const schemas = require('./product.validation');
const variantRoute = require('../product-variants/variant.nested.route');
const imageRoute = require('../product-images/image.route');

const router = express.Router();

// Route lồng: /products/:productId/variants và /products/:productId/images
router.use('/:productId/variants', variantRoute);
router.use('/:productId/images', imageRoute);

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
  validate(schemas.deleteSchema),
  controller.remove
);

module.exports = router;
