'use strict';

const express = require('express');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const controller = require('./cart.controller');
const schemas = require('./cart.validation');

const router = express.Router();

// Giỏ hàng là của khách; ADMIN/STAFF không có giỏ.
router.use(authenticate, requireRole('CUSTOMER'));

router.get('/', controller.getCart);
router.delete('/', controller.clear);

router.post('/items', validate(schemas.addItemSchema), controller.addItem);
router.put('/items/:itemId', validate(schemas.updateItemSchema), controller.updateItem);
router.delete('/items/:itemId', validate(schemas.itemParamSchema), controller.removeItem);

router.post('/preview', validate(schemas.previewSchema), controller.preview);

module.exports = router;
