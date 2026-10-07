'use strict';

const express = require('express');
const healthRoute = require('../modules/health/health.route');
const authRoute = require('../modules/auth/auth.route');
const userRoute = require('../modules/users/user.route');
const roleRoute = require('../modules/roles/role.route');
const permissionRoute = require('../modules/roles/permission.route');

const router = express.Router();

router.use('/health', healthRoute);
router.use('/auth', authRoute);
router.use('/users', userRoute);
router.use('/roles', roleRoute);
router.use('/permissions', permissionRoute);

module.exports = router;
