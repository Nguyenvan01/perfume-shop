'use strict';

const { z, email, password, fullName, phone } = require('../../utils/validation');

const registerSchema = {
  body: z.object({
    email,
    password,
    full_name: fullName,
    phone,
    address: z.string().trim().max(255).optional(),
  }),
};

const loginSchema = {
  body: z.object({
    email,
    // Login không áp rule độ mạnh — chỉ cần không rỗng, sai thì trả 401 chung.
    password: z.string().min(1, { message: 'Password is required' }),
  }),
};

const refreshSchema = {
  body: z.object({ refreshToken: z.string().min(1, { message: 'refreshToken is required' }) }),
};

const updateProfileSchema = {
  body: z
    .object({
      full_name: fullName.optional(),
      phone,
      address: z.string().trim().max(255).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'No field to update' }),
};

const changePasswordSchema = {
  body: z.object({
    current_password: z.string().min(1, { message: 'Current password is required' }),
    new_password: password,
  }),
};

const forgotPasswordSchema = { body: z.object({ email }) };

const resetPasswordSchema = {
  body: z.object({
    token: z.string().min(1, { message: 'Token is required' }),
    new_password: password,
  }),
};

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
