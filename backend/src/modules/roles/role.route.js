'use strict';

const express = require('express');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const controller = require('./role.controller');
const schemas = require('./role.validation');

const router = express.Router();

// ADMIN only — STAFF gọi GET /roles phải nhận 403 (TC09).
router.use(authenticate, requireRole('ADMIN'));

router.get('/', controller.list);
router.post('/', validate(schemas.createSchema), controller.create);
router.get('/:id', validate(schemas.detailSchema), controller.detail);
router.put('/:id', validate(schemas.updateSchema), controller.update);
router.delete('/:id', validate(schemas.detailSchema), controller.remove);

module.exports = router;
