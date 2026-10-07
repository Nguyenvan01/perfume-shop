'use strict';

const express = require('express');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const controller = require('./role.controller');

const router = express.Router();

router.use(authenticate, requireRole('ADMIN'));
router.get('/', controller.listPermissions);

module.exports = router;
