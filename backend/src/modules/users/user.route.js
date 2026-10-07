'use strict';

const express = require('express');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const controller = require('./user.controller');
const schemas = require('./user.validation');

const router = express.Router();

// Toàn bộ module chỉ ADMIN — STAFF gọi vào đây phải nhận 403 (TC09).
router.use(authenticate, requireRole('ADMIN'));

router.get('/', validate(schemas.listSchema), controller.list);
router.post('/', validate(schemas.createSchema), controller.create);
router.get('/:id', validate(schemas.detailSchema), controller.detail);
router.put('/:id', validate(schemas.updateSchema), controller.update);
router.patch('/:id/status', validate(schemas.setStatusSchema), controller.setStatus);
router.patch(
  '/:id/reset-password',
  validate(schemas.resetPasswordSchema),
  controller.resetPassword
);
router.delete('/:id', validate(schemas.detailSchema), controller.remove);

module.exports = router;
