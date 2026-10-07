'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const env = require('../../config/env');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const controller = require('./auth.controller');
const schemas = require('./auth.validation');

const router = express.Router();

/** Chặn brute-force mật khẩu. Tắt ở test để không làm nhiễu test suite. */
const authLimiter = env.isTest
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 5 * 60 * 1000,
      limit: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, message: 'Too many attempts. Please try again later.', errors: [] },
    });

router.post('/register', validate(schemas.registerSchema), controller.register);
router.post('/login', authLimiter, validate(schemas.loginSchema), controller.login);
router.post('/refresh', validate(schemas.refreshSchema), controller.refresh);
router.post('/logout', authenticate, validate(schemas.refreshSchema), controller.logout);

router.get('/me', authenticate, controller.me);
router.put('/me', authenticate, validate(schemas.updateProfileSchema), controller.updateMe);
router.post(
  '/change-password',
  authenticate,
  validate(schemas.changePasswordSchema),
  controller.changePassword
);

router.post(
  '/forgot-password',
  authLimiter,
  validate(schemas.forgotPasswordSchema),
  controller.forgotPassword
);
router.post('/reset-password', validate(schemas.resetPasswordSchema), controller.resetPassword);

module.exports = router;
