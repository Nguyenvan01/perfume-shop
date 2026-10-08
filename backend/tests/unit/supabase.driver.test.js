'use strict';

const AppError = require('../../src/utils/AppError');
const {
  createSupabaseDriver,
  buildAuthHeaders,
  CACHE_CONTROL,
} = require('../../src/utils/storage/supabase.driver');

// Key legacy service_role là JWT (3 phần); key mới sb_secret_ là chuỗi opaque.
const LEGACY_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.LEGACY-SECRET-sig';
const NEW_KEY = 'sb_secret_NEW-SECRET-abc123';
const BASE_URL = 'https://proj-ref.supabase.co';
const BUCKET = 'product-images';
const UUID_PATH = /^products\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/;

const okResponse = (payload = { Key: 'x' }) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

function makeDriver(fetchImpl, overrides = {}) {
  return createSupabaseDriver({
    url: `${BASE_URL}/`, // dấu "/" cuối phải được bỏ
    serviceRoleKey: LEGACY_KEY,
    bucket: BUCKET,
    fetchImpl,
    ...overrides,
  });
}

/** Mọi thứ lộ ra ngoài từ một lỗi: message, errors, stack, JSON. */
const exposedText = (error) =>
  [error.message, JSON.stringify(error.errors ?? []), error.stack, JSON.stringify(error)].join('\n');

describe('supabase storage driver — auth headers', () => {
  test('legacy JWT service_role key → apikey + Authorization Bearer', () => {
    expect(buildAuthHeaders(LEGACY_KEY)).toEqual({
      apikey: LEGACY_KEY,
      authorization: `Bearer ${LEGACY_KEY}`,
    });
  });

  test('new sb_secret_ key → apikey only, never Bearer', () => {
    expect(buildAuthHeaders(NEW_KEY)).toEqual({ apikey: NEW_KEY });
  });

  test('an sb_ key that happens to contain dots is still not sent as Bearer', () => {
    expect(buildAuthHeaders('sb_secret_a.b.c')).toEqual({ apikey: 'sb_secret_a.b.c' });
  });

  test.each([
    ['legacy', LEGACY_KEY, `Bearer ${LEGACY_KEY}`],
    ['sb_secret_', NEW_KEY, undefined],
  ])('%s key: upload and delete both send the expected headers', async (_label, key, bearer) => {
    const fetchImpl = jest.fn().mockImplementation(async () => okResponse([]));
    const driver = makeDriver(fetchImpl, { serviceRoleKey: key });

    await driver.upload(Buffer.from('x'), { mimetype: 'image/png' });
    await driver.destroy('products/a.png');

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchImpl.mock.calls) {
      expect(init.headers.apikey).toBe(key);
      expect(init.headers.authorization).toBe(bearer);
    }
  });
});

describe('supabase storage driver — upload', () => {
  test('POSTs the buffer to <bucket>/<folder>/<uuid>.<ext> with content-type, cache-control, no upsert', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(okResponse());
    const driver = makeDriver(fetchImpl);
    const buffer = Buffer.from('fake-image-bytes');

    const result = await driver.upload(buffer, {
      filename: 'my photo.WEBP',
      mimetype: 'image/webp',
      folder: 'products',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    const prefix = `${BASE_URL}/storage/v1/object/${BUCKET}/`;
    expect(url.startsWith(prefix)).toBe(true);
    const objectPath = url.slice(prefix.length);
    expect(objectPath).toMatch(UUID_PATH);

    expect(init.method).toBe('POST');
    expect(init.body).toBe(buffer);
    expect(init.headers['content-type']).toBe('image/webp');
    expect(init.headers['cache-control']).toBe(CACHE_CONTROL);
    expect(CACHE_CONTROL).toBe('max-age=31536000');
    expect(init.headers['x-upsert']).toBe('false');
    expect(init.signal).toBeInstanceOf(AbortSignal);

    expect(result).toEqual({
      public_id: objectPath,
      url: `${BASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`,
    });
  });

  test('returns an absolute https URL (frontend resolveImageUrl passes it through) and never the key', async () => {
    const driver = makeDriver(jest.fn().mockResolvedValue(okResponse()));
    const result = await driver.upload(Buffer.from('x'), { mimetype: 'image/png', folder: 'brands' });

    expect(result.url).toMatch(/^https:\/\//);
    expect(result.public_id).toMatch(/^brands\/[0-9a-f-]{36}\.png$/);
    expect(JSON.stringify(result)).not.toContain(LEGACY_KEY);
  });

  test('derives the extension from the mimetype, never from the user-supplied filename', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(okResponse());
    const driver = makeDriver(fetchImpl);

    const { public_id } = await driver.upload(Buffer.from('x'), {
      filename: '../../etc/passwd.php',
      mimetype: 'image/jpeg',
      folder: 'products',
    });

    expect(public_id).toMatch(/^products\/[0-9a-f-]{36}\.jpg$/);
    expect(fetchImpl.mock.calls[0][0]).not.toContain('passwd');
  });

  test.each([['image/svg+xml'], ['text/html'], ['application/octet-stream'], [undefined]])(
    'rejects unsupported mimetype %p with AppError 400 before calling the API',
    async (mimetype) => {
      const fetchImpl = jest.fn();
      const error = await makeDriver(fetchImpl)
        .upload(Buffer.from('x'), { filename: 'evil.png', mimetype })
        .catch((caught) => caught);

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toMatch(/^Unsupported image type/);
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  );

  test('generates a unique path per upload', async () => {
    const driver = makeDriver(jest.fn().mockImplementation(async () => okResponse()));
    const a = await driver.upload(Buffer.from('a'), { mimetype: 'image/png' });
    const b = await driver.upload(Buffer.from('b'), { mimetype: 'image/png' });
    expect(a.public_id).not.toBe(b.public_id);
  });

  test('rejects a folder that could escape the bucket prefix', async () => {
    const fetchImpl = jest.fn();
    const driver = makeDriver(fetchImpl);

    await expect(
      driver.upload(Buffer.from('x'), { mimetype: 'image/png', folder: '../secret' })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('upstream error → AppError 502 with status only; body and key never leak', async () => {
    const leakyBody = JSON.stringify({ error: 'Unauthorized', message: `bad key ${LEGACY_KEY}` });
    const fetchImpl = jest.fn().mockResolvedValue(new Response(leakyBody, { status: 403 }));
    const driver = makeDriver(fetchImpl);

    const error = await driver
      .upload(Buffer.from('x'), { mimetype: 'image/png' })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(502);
    expect(error.message).toBe('Storage upload failed (403)');
    expect(exposedText(error)).not.toContain(LEGACY_KEY);
    expect(exposedText(error)).not.toContain('bad key');
  });

  test('network failure → AppError 502 without forwarding the fetch error detail', async () => {
    const networkError = new TypeError(`fetch failed: Authorization Bearer ${LEGACY_KEY}`);
    const driver = makeDriver(jest.fn().mockRejectedValue(networkError));

    const error = await driver
      .upload(Buffer.from('x'), { mimetype: 'image/png' })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(502);
    expect(error.message).toBe('Storage upload failed: storage service unreachable');
    expect(exposedText(error)).not.toContain(LEGACY_KEY);
  });

  test('a hanging request is aborted by the timeout signal → AppError 502 "timed out"', async () => {
    let receivedSignal;
    // fetch giả treo mãi, chỉ kết thúc khi signal abort — giống fetch thật.
    const hangingFetch = jest.fn((_url, init) => {
      receivedSignal = init.signal;
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
      });
    });
    const driver = makeDriver(hangingFetch, { timeoutMs: 30 });

    const error = await driver
      .upload(Buffer.from('x'), { mimetype: 'image/png' })
      .catch((caught) => caught);

    expect(receivedSignal.aborted).toBe(true);
    expect(receivedSignal.reason?.name).toBe('TimeoutError');
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(502);
    expect(error.message).toBe('Storage upload failed: storage service timed out');
  });
});

describe('supabase storage driver — destroy', () => {
  test('DELETEs the object via the bucket prefixes endpoint with apikey', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(okResponse([]));
    const driver = makeDriver(fetchImpl, { serviceRoleKey: NEW_KEY });

    await driver.destroy('products/abc-123.webp');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/storage/v1/object/${BUCKET}`);
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body)).toEqual({ prefixes: ['products/abc-123.webp'] });
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.headers.apikey).toBe(NEW_KEY);
    expect(init.headers).not.toHaveProperty('authorization');
  });

  test.each([[undefined], [null], ['']])('is a no-op for empty public_id %p', async (publicId) => {
    const fetchImpl = jest.fn();
    await makeDriver(fetchImpl).destroy(publicId);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test.each([['../other-bucket/x.png'], ['products/../../x.png'], ['/abs/path.png'], ['a b.png']])(
    'ignores a suspicious public_id %p without calling the API',
    async (publicId) => {
      const fetchImpl = jest.fn();
      await makeDriver(fetchImpl).destroy(publicId);
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  );

  test('upstream error → AppError 502 without leaking the key', async () => {
    const driver = makeDriver(
      jest.fn().mockResolvedValue(new Response(`denied for ${LEGACY_KEY}`, { status: 500 }))
    );

    const error = await driver.destroy('products/a.png').catch((caught) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(502);
    expect(error.message).toBe('Storage delete failed (500)');
    expect(exposedText(error)).not.toContain(LEGACY_KEY);
  });
});

describe('supabase storage driver — construction', () => {
  test.each([
    [{ url: '' }],
    [{ serviceRoleKey: '' }],
    [{ bucket: '' }],
  ])('throws when config is incomplete %p, without echoing the key', (override) => {
    let error;
    try {
      makeDriver(jest.fn(), override);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_STORAGE_BUCKET/);
    expect(error.message).not.toContain(LEGACY_KEY);
  });

  test('uses global fetch when no fetchImpl is injected', async () => {
    const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse([]));
    try {
      await makeDriver(undefined).destroy('products/a.png');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
