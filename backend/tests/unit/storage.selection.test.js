'use strict';

/**
 * Chọn storage driver theo env + fail-fast cấu hình storage khi boot.
 * Mỗi test nạp lại module trong jest.isolateModules để không ảnh hưởng app thật.
 */

const SERVICE_KEY = 'sb-service-role-SECRET-xyz';

const STORAGE_KEYS = [
  'STORAGE_DRIVER',
  'VERCEL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_STORAGE_BUCKET',
];

describe('config/env — storage fail-fast', () => {
  let saved;

  beforeEach(() => {
    saved = Object.fromEntries(STORAGE_KEYS.map((key) => [key, process.env[key]]));
    // Đặt rỗng (không delete): dotenv không ghi đè biến đã tồn tại, nên giá trị
    // trong backend/.env của máy dev không lọt vào test.
    for (const key of STORAGE_KEYS) process.env[key] = '';
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

  test('defaults to the local driver off Vercel', () => {
    const env = loadEnv();
    expect(env.STORAGE_DRIVER).toBe('local');
    expect(env.isVercel).toBe(false);
  });

  test('STORAGE_DRIVER=local on Vercel fails fast with a clear message', () => {
    process.env.VERCEL = '1';
    expect(loadEnv).toThrow(/STORAGE_DRIVER=local is not supported on Vercel/);

    process.env.STORAGE_DRIVER = 'local';
    expect(loadEnv).toThrow(/not supported on Vercel/);
  });

  test('STORAGE_DRIVER=supabase with missing vars fails fast, naming only the missing keys', () => {
    process.env.STORAGE_DRIVER = 'supabase';
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;

    let error;
    try {
      loadEnv();
    } catch (caught) {
      error = caught;
    }
    expect(error?.message).toBe(
      'STORAGE_DRIVER=supabase but missing env: SUPABASE_URL, SUPABASE_STORAGE_BUCKET'
    );
    expect(error.message).not.toContain(SERVICE_KEY);
  });

  test('STORAGE_DRIVER=supabase rejects a non-URL SUPABASE_URL', () => {
    Object.assign(process.env, {
      STORAGE_DRIVER: 'supabase',
      SUPABASE_URL: 'proj-ref.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      SUPABASE_STORAGE_BUCKET: 'product-images',
    });
    expect(loadEnv).toThrow(/SUPABASE_URL must be an http\(s\) URL/);
  });

  test('STORAGE_DRIVER=supabase with full config loads, also on Vercel', () => {
    Object.assign(process.env, {
      VERCEL: '1',
      STORAGE_DRIVER: 'supabase',
      SUPABASE_URL: 'https://proj-ref.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      SUPABASE_STORAGE_BUCKET: 'product-images',
    });
    const env = loadEnv();
    expect(env).toMatchObject({
      isVercel: true,
      STORAGE_DRIVER: 'supabase',
      SUPABASE_URL: 'https://proj-ref.supabase.co',
      SUPABASE_STORAGE_BUCKET: 'product-images',
    });
  });
});

describe('utils/storage — driver selection', () => {
  const baseEnv = {
    STORAGE_DRIVER: 'local',
    isVercel: false,
    UPLOAD_DIR: 'uploads',
    SUPABASE_URL: 'https://proj-ref.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    SUPABASE_STORAGE_BUCKET: 'product-images',
  };

  const loadStorage = (envOverrides) => {
    let storage;
    jest.isolateModules(() => {
      jest.doMock('../../src/config/env', () => ({ ...baseEnv, ...envOverrides }));
      storage = require('../../src/utils/storage');
    });
    return storage;
  };

  afterEach(() => {
    jest.dontMock('../../src/config/env');
  });

  test.each([['local'], ['cloudinary'], ['supabase']])(
    'STORAGE_DRIVER=%s selects that driver with the shared interface',
    (driverName) => {
      const storage = loadStorage({ STORAGE_DRIVER: driverName });
      expect(storage.name).toBe(driverName);
      expect(typeof storage.upload).toBe('function');
      expect(typeof storage.destroy).toBe('function');
    }
  );

  test('supabase driver is wired with env values (public URL uses SUPABASE_URL + bucket)', () => {
    const storage = loadStorage({ STORAGE_DRIVER: 'supabase' });
    expect(storage.publicUrl('products/a.png')).toBe(
      'https://proj-ref.supabase.co/storage/v1/object/public/product-images/products/a.png'
    );
  });

  test('unknown driver fails fast', () => {
    expect(() => loadStorage({ STORAGE_DRIVER: 's3' })).toThrow(
      'Unknown STORAGE_DRIVER "s3". Expected one of: local, cloudinary, supabase'
    );
  });

  test('local driver is refused on Vercel even if env validation was bypassed', () => {
    expect(() => loadStorage({ STORAGE_DRIVER: 'local', isVercel: true })).toThrow(
      /not supported on Vercel/
    );
  });

  test('supabase driver with incomplete config fails at selection', () => {
    expect(() => loadStorage({ STORAGE_DRIVER: 'supabase', SUPABASE_STORAGE_BUCKET: '' })).toThrow(
      /requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_STORAGE_BUCKET/
    );
  });
});
