'use strict';

const {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  generateOpaqueToken,
  expiresAtFrom,
} = require('../../src/utils/jwt');

describe('access token', () => {
  it('mang id, email và roles', () => {
    const token = signAccessToken({ id: 7, email: 'a@b.local', roles: ['ADMIN'] });
    const payload = verifyAccessToken(token);

    expect(payload.sub).toBe(7);
    expect(payload.email).toBe('a@b.local');
    expect(payload.roles).toEqual(['ADMIN']);
  });

  it('không mang permission (tránh token phình và stale)', () => {
    const payload = verifyAccessToken(signAccessToken({ id: 1, email: 'a@b.local', roles: [] }));
    expect(payload.permissions).toBeUndefined();
  });

  it('access secret khác refresh secret → không verify chéo được', () => {
    const access = signAccessToken({ id: 1, email: 'a@b.local', roles: [] });
    expect(() => verifyRefreshToken(access)).toThrow();
  });
});

describe('refresh token', () => {
  it('hai lần sign cùng user cho ra token khác nhau (jti)', () => {
    const first = signRefreshToken({ id: 1 });
    const second = signRefreshToken({ id: 1 });
    expect(first).not.toBe(second);
    expect(hashToken(first)).not.toBe(hashToken(second));
  });
});

describe('hashToken', () => {
  it('ổn định và không thể suy ra token gốc', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).toHaveLength(64);
    expect(hashToken('abc')).not.toContain('abc');
  });
});

describe('generateOpaqueToken', () => {
  it('trả raw để gửi user và hash để lưu DB', () => {
    const { raw, hash } = generateOpaqueToken();
    expect(raw).toHaveLength(64);
    expect(hash).toBe(hashToken(raw));
  });
});

describe('expiresAtFrom', () => {
  it('parse đúng các đơn vị', () => {
    const now = Date.now();
    expect(expiresAtFrom('30s').getTime()).toBeCloseTo(now + 30_000, -3);
    expect(expiresAtFrom('15m').getTime()).toBeCloseTo(now + 900_000, -3);
    expect(expiresAtFrom('7d').getTime()).toBeCloseTo(now + 604_800_000, -3);
  });

  it('định dạng sai → throw', () => {
    expect(() => expiresAtFrom('7 days')).toThrow();
  });
});
