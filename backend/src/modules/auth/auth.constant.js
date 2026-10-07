'use strict';

const BCRYPT_ROUNDS = 10;

/** Token reset password sống 30 phút. */
const RESET_TOKEN_EXPIRES = '30m';

const DEFAULT_ROLE = 'CUSTOMER';

/** Field an toàn để trả ra API — tuyệt đối không có password_hash. */
const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  full_name: true,
  phone: true,
  status: true,
  created_at: true,
  user_roles: { select: { role: { select: { name: true } } } },
};

module.exports = { BCRYPT_ROUNDS, RESET_TOKEN_EXPIRES, DEFAULT_ROLE, USER_PUBLIC_SELECT };
