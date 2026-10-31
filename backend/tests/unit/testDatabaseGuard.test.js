'use strict';

/**
 * Regression: NODE_ENV=test thiếu DATABASE_URL_TEST từng âm thầm dùng DATABASE_URL,
 * khiến TRUNCATE ... CASCADE của test suite có thể xóa sạch DB dev/prod.
 */

const { prisma, assertTestDatabase } = require('../../src/config/database');

const DEV_URL = 'postgresql://perfume:perfume@localhost:5434/perfume_shop';
const TEST_URL = 'postgresql://perfume:perfume@localhost:5434/perfume_shop_test';

const ENV_KEYS = [
  'NODE_ENV',
  'DATABASE_URL',
  'DIRECT_URL',
  'DATABASE_URL_TEST',
  'DIRECT_URL_TEST',
  'NON_TEST_DATABASE_URL',
  'NON_TEST_DIRECT_URL',
];

describe('config/env — DB test phải tách biệt DB dev/prod', () => {
  let saved;

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
    // Giả lập một process mới: chưa có URL gốc nào được ghi nhớ.
    delete process.env.NON_TEST_DATABASE_URL;
    delete process.env.NON_TEST_DIRECT_URL;
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = DEV_URL;
    process.env.DIRECT_URL = DEV_URL;
    // Đặt rỗng (không delete): dotenv không ghi đè biến đã tồn tại, nên giá trị
    // trong backend/.env của máy dev không lọt vào test.
    process.env.DATABASE_URL_TEST = '';
    process.env.DIRECT_URL_TEST = '';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const loadEnv = () => {
    let env;
    jest.isolateModules(() => {
      env = require('../../src/config/env');
    });
    return env;
  };

  it('thiếu DATABASE_URL_TEST → fail-fast, KHÔNG fallback sang DATABASE_URL', () => {
    expect(loadEnv).toThrow(/Missing DATABASE_URL_TEST/);
    expect(process.env.DATABASE_URL).toBe(DEV_URL);
  });

  it('DATABASE_URL_TEST trùng DATABASE_URL → từ chối', () => {
    process.env.DATABASE_URL_TEST = DEV_URL;
    expect(loadEnv).toThrow(/same database as DATABASE_URL/);
  });

  it('cùng DB dù khác port / credential / localhost vs 127.0.0.1 / query → vẫn coi là trùng', () => {
    process.env.DATABASE_URL_TEST = 'postgresql://other:secret@127.0.0.1:6543/perfume_shop?pgbouncer=true';
    expect(loadEnv).toThrow(/same database/);
  });

  it('DATABASE_URL_TEST trùng DIRECT_URL (không trùng DATABASE_URL) → từ chối', () => {
    process.env.DIRECT_URL = 'postgresql://perfume:perfume@db.example.com:5432/postgres';
    process.env.DATABASE_URL_TEST = 'postgresql://perfume:perfume@db.example.com:6543/postgres';
    expect(loadEnv).toThrow(/same database as DIRECT_URL/);
  });

  it('DIRECT_URL_TEST trỏ về DB dev → từ chối', () => {
    process.env.DATABASE_URL_TEST = TEST_URL;
    process.env.DIRECT_URL_TEST = DEV_URL;
    expect(loadEnv).toThrow(/DIRECT_URL_TEST points to the same database/);
  });

  it('DB test riêng → OK; DATABASE_URL/DIRECT_URL được trỏ sang DB test', () => {
    process.env.DATABASE_URL_TEST = TEST_URL;
    const env = loadEnv();

    expect(env.DATABASE_URL).toBe(TEST_URL);
    expect(env.DIRECT_URL).toBe(TEST_URL);
    expect(process.env.DATABASE_URL).toBe(TEST_URL);
    expect(process.env.DIRECT_URL).toBe(TEST_URL);
  });

  it('nạp lại env.js trong cùng process (DATABASE_URL đã bị trỏ sang test) không báo nhầm', () => {
    process.env.DATABASE_URL_TEST = TEST_URL;
    loadEnv();
    expect(() => loadEnv()).not.toThrow();
  });
});

describe('assertTestDatabase — chốt chặn trước TRUNCATE / migrate test', () => {
  const fakeClient = (name) => ({ $queryRaw: async () => [{ name }] });

  it('DB đang kết nối của test suite là *_test', async () => {
    await expect(assertTestDatabase(prisma)).resolves.toMatch(/_test$/);
  });

  it('từ chối DB không kết thúc bằng _test', async () => {
    await expect(assertTestDatabase(fakeClient('perfume_shop'))).rejects.toThrow(/Refusing/);
    await expect(assertTestDatabase(fakeClient('postgres'))).rejects.toThrow(/Refusing/);
    await expect(assertTestDatabase(fakeClient('perfume_test_shop'))).rejects.toThrow(/Refusing/);
  });

  it('chấp nhận DB *_test', async () => {
    await expect(assertTestDatabase(fakeClient('perfume_shop_test'))).resolves.toBe('perfume_shop_test');
  });
});
