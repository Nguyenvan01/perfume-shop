'use strict';

const express = require('express');
const healthRoute = require('../modules/health/health.route');

const router = express.Router();

// W1 — mỗi milestone sau sẽ mount thêm module route tại đây.
router.use('/health', healthRoute);

module.exports = router;
