'use strict';

const bcrypt = require('bcryptjs');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const repo = require('./auth.repository');
const { BCRYPT_ROUNDS, RESET_TOKEN_EXPIRES, DEFAULT_ROLE } = require('./auth.constant');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateOpaqueToken,
  expiresAtFrom,
} = require('../../utils/jwt');

/** Chuyển record Prisma thành UserDTO theo contract §2 — không bao giờ kèm password_hash. */
function toUserDTO(user) {
  if (!user) return null;
  const { user_roles, password_hash: _password_hash, ...rest } = user;
  return { ...rest, roles: (user_roles ?? []).map((item) => item.role.name) };
}

async function issueTokens(user) {
  const dto = toUserDTO(user);
  const accessToken = signAccessToken({ id: dto.id, email: dto.email, roles: dto.roles });
  const refreshToken = signRefreshToken({ id: dto.id });

  await repo.createRefreshToken({
    user_id: dto.id,
    token_hash: hashToken(refreshToken),
    expires_at: expiresAtFrom(env.JWT_REFRESH_EXPIRES),
  });

  return { user: dto, accessToken, refreshToken };
}

async function register({ email, password, full_name, phone, address }) {
  const existing = await repo.findUserByEmail(email);
  if (existing) throw AppError.conflict('Email already registered');

  const role = await repo.findRoleByName(DEFAULT_ROLE);
  if (!role) throw new AppError(500, 'Default role CUSTOMER is missing. Run database seed.');

  const user = await repo.createCustomerAccount({
    email,
    password_hash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    full_name,
    phone,
    address,
    role_id: role.id,
  });

  return issueTokens(user);
}

async function login({ email, password }) {
  const user = await repo.findUserByEmail(email);

  // Message giống nhau cho email không tồn tại và sai mật khẩu — không tiết lộ
  // email nào đã đăng ký (TC02).
  if (!user) throw AppError.unauthorized('Invalid credentials');

  const matched = await bcrypt.compare(password, user.password_hash);
  if (!matched) throw AppError.unauthorized('Invalid credentials');

  if (user.status === 'LOCKED') throw AppError.forbidden('Account is locked');

  return issueTokens(user);
}

/** Refresh có rotation: token cũ bị thu hồi ngay, phát cặp mới. */
async function refresh(refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw AppError.unauthorized('Invalid or expired refresh token');
  }

  const stored = await repo.findRefreshToken(hashToken(refreshToken));
  if (!stored) throw AppError.unauthorized('Invalid or expired refresh token');

  // Token đã thu hồi mà vẫn được dùng → coi như bị đánh cắp, hạ toàn bộ session.
  if (stored.revoked_at) {
    await repo.revokeAllRefreshTokens(stored.user_id);
    throw AppError.unauthorized('Refresh token has been revoked');
  }

  if (stored.expires_at <= new Date()) {
    throw AppError.unauthorized('Invalid or expired refresh token');
  }

  const user = await repo.findUserById(payload.sub);
  if (!user) throw AppError.unauthorized('User no longer exists');
  if (user.status === 'LOCKED') throw AppError.forbidden('Account is locked');

  await repo.revokeRefreshToken(stored.id);
  const tokens = await issueTokens(user);
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
}

async function logout(refreshToken) {
  const stored = await repo.findRefreshToken(hashToken(refreshToken));
  // Logout là idempotent: token sai/đã thu hồi vẫn trả thành công.
  if (stored && !stored.revoked_at) await repo.revokeRefreshToken(stored.id);
}

async function getProfile(userId) {
  const user = await repo.findUserById(userId);
  if (!user) throw AppError.notFound('User not found');

  const dto = toUserDTO(user);
  const customer = await repo.findCustomerByUserId(userId);
  dto.address = customer?.address ?? null;
  dto.permissions = await repo.findPermissionCodes(userId);
  return dto;
}

async function updateProfile(userId, { full_name, phone, address }) {
  const data = {};
  if (full_name !== undefined) data.full_name = full_name;
  if (phone !== undefined) data.phone = phone;

  const user = Object.keys(data).length
    ? await repo.updateUserProfile(userId, data)
    : await repo.findUserById(userId);

  // address nằm ở bảng customers, chỉ cập nhật khi user có profile khách hàng.
  if (address !== undefined) {
    const customer = await repo.findCustomerByUserId(userId);
    if (!customer) throw AppError.badRequest('Only customer accounts have an address');
    await repo.updateCustomerAddress(userId, address);
  }

  return getProfile(user.id);
}

async function changePassword(userId, { current_password, new_password }) {
  const user = await repo.findUserWithPassword(userId);
  if (!user) throw AppError.notFound('User not found');

  const matched = await bcrypt.compare(current_password, user.password_hash);
  if (!matched) throw AppError.unauthorized('Current password is incorrect');

  if (await bcrypt.compare(new_password, user.password_hash)) {
    throw AppError.badRequest('New password must be different from the current password');
  }

  await repo.updatePasswordHash(userId, await bcrypt.hash(new_password, BCRYPT_ROUNDS));
  // Đổi mật khẩu → mọi session cũ phải đăng nhập lại.
  await repo.revokeAllRefreshTokens(userId);
}

/**
 * Luôn trả thành công để không tiết lộ email nào tồn tại.
 * Dev (OD-6): trả token trong response thay vì gửi email.
 */
async function forgotPassword(email) {
  const user = await repo.findUserByEmail(email);
  if (!user || user.status === 'LOCKED') return {};

  const { raw, hash } = generateOpaqueToken();
  await repo.createResetToken({
    user_id: user.id,
    token_hash: hash,
    expires_at: expiresAtFrom(RESET_TOKEN_EXPIRES),
  });

  if (env.isProduction) return {};
  return { reset_token: raw };
}

async function resetPassword({ token, new_password }) {
  const stored = await repo.findResetToken(hashToken(token));
  if (!stored) throw AppError.badRequest('Invalid reset token');
  if (stored.used_at) throw AppError.gone('Reset token has already been used');
  if (stored.expires_at <= new Date()) throw AppError.gone('Reset token has expired');

  await repo.updatePasswordHash(stored.user_id, await bcrypt.hash(new_password, BCRYPT_ROUNDS));
  await repo.markResetTokenUsed(stored.id);
  await repo.revokeAllRefreshTokens(stored.user_id);
}

module.exports = {
  toUserDTO,
  register,
  login,
  refresh,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
};
