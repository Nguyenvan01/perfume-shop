'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { ok, created, noContent } = require('../../utils/response');
const service = require('./auth.service');

const register = asyncHandler(async (req, res) =>
  created(res, await service.register(req.body), 'Registered successfully')
);

const login = asyncHandler(async (req, res) =>
  ok(res, await service.login(req.body), 'Logged in successfully')
);

const refresh = asyncHandler(async (req, res) =>
  ok(res, await service.refresh(req.body.refreshToken), 'Token refreshed')
);

const logout = asyncHandler(async (req, res) => {
  await service.logout(req.body.refreshToken);
  return noContent(res, 'Logged out successfully');
});

const me = asyncHandler(async (req, res) => ok(res, await service.getProfile(req.user.id)));

const updateMe = asyncHandler(async (req, res) =>
  ok(res, await service.updateProfile(req.user.id, req.body), 'Profile updated')
);

const changePassword = asyncHandler(async (req, res) => {
  await service.changePassword(req.user.id, req.body);
  return noContent(res, 'Password changed successfully. Please sign in again.');
});

const forgotPassword = asyncHandler(async (req, res) => {
  const data = await service.forgotPassword(req.body.email);
  return ok(res, data, 'If the email exists, a reset link has been sent');
});

const resetPassword = asyncHandler(async (req, res) => {
  await service.resetPassword(req.body);
  return noContent(res, 'Password reset successfully');
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
};
