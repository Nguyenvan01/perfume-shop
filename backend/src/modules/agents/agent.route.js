'use strict';

const express = require('express');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validation.middleware');
const { createLimiter } = require('../../middleware/security.middleware');
const controller = require('./agent.controller');
const { runSchema } = require('./agent.validation');
const { RUN_RATE_LIMIT } = require('./agent.constant');

const router = express.Router();

// Keyed by admin user (runs only after authenticate), not by IP.
const runLimiter = createLimiter({
  ...RUN_RATE_LIMIT,
  message: 'Too many agent runs. Please try again later.',
  keyGenerator: (req) => `agent-run:${req.user.id}`,
});

// This endpoint can spend paid provider credits, so it is intentionally more
// restricted than normal staff operations.
router.use(authenticate, requireRole('ADMIN'));
router.get('/models', controller.listModels);
router.post('/runs', runLimiter, validate(runSchema), controller.run);

module.exports = router;
