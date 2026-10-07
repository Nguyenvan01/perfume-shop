'use strict';

const { z } = require('zod');

/** Mảnh zod dùng lại giữa các module, để validate nhất quán. */

const idParam = z.object({
  id: z.coerce.number().int().positive({ message: 'id must be a positive integer' }),
});

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  q: z.string().trim().optional(),
});

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { message: 'Email is required' })
  .email({ message: 'Email is invalid' })
  .max(191);

/** Mật khẩu: tối thiểu 8 ký tự, có cả chữ và số. */
const password = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters' })
  .max(72, { message: 'Password must be at most 72 characters' })
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    message: 'Password must contain both letters and numbers',
  });

const fullName = z.string().trim().min(2, { message: 'Full name is too short' }).max(120);

const phone = z
  .string()
  .trim()
  .regex(/^0\d{8,10}$/, { message: 'Phone number is invalid' })
  .optional();

module.exports = { idParam, paginationQuery, email, password, fullName, phone, z };
