'use strict';

const AppError = require('../../src/utils/AppError');
const { createSupabaseDriver } = require('../../src/utils/storage/supabase.driver');

const SERVICE_KEY = 'sb-service-role-SECRET-xyz';
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
    serviceRoleKey: SERVICE_KEY,
    bucket: BUCKET,
    fetchImpl,
    ...overrides,
  });
}

/** Mọi thứ lộ ra ngoài từ một lỗi: message, errors, stack, JSON. */
const exposedText = (error) =>
  [error.message, JSON.stringify(error.errors ?? []), error.stack, JSON.stringify(error)].join('\n');

describe('supabase storage driver — upload', () => {
  test('POSTs the buffer to <bucket>/<folder>/<uuid>.<ext> with content-type and auth headers', async () => {
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
    expect(init.headers['x-upsert']).toBe('false');
    expect(init.headers.authorization).toBe(`Bearer ${SERVICE_KEY}`);
    expect(init.headers.apikey).toBe(SERVICE_KEY);
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
    expect(JSON.stringify(result)).not.toContain(SERVICE_KEY);
  });

  test('derives the extension from the mimetype, not the user-supplied filename', async () => {
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
    const leakyBody = JSON.stringify({ error: 'Unauthorized', message: `bad key ${SERVICE_KEY}` });
    const fetchImpl = jest.fn().mockResolvedValue(new Response(leakyBody, { status: 403 }));
    const driver = makeDriver(fetchImpl);

    const error = await driver
      .upload(Buffer.from('x'), { mimetype: 'image/png' })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(502);
    expect(error.message).toBe('Storage upload failed (403)');
    expect(exposedText(error)).not.toContain(SERVICE_KEY);
    expect(exposedText(error)).not.toContain('bad key');
  });

  test('network failure → AppError 502 without forwarding the fetch error detail', async () => {
    const networkError = new TypeError(`fetch failed: Authorization Bearer ${SERVICE_KEY}`);
    const driver = makeDriver(jest.fn().mockRejectedValue(networkError));

    const error = await driver
      .upload(Buffer.from('x'), { mimetype: 'image/png' })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(502);
    expect(error.message).toBe('Storage upload failed: storage service unreachable');
    expect(exposedText(error)).not.toContain(SERVICE_KEY);
  });

  test('timeout → AppError 502 "timed out"', async () => {
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const driver = makeDriver(jest.fn().mockRejectedValue(timeout));

    await expect(driver.upload(Buffer.from('x'), { mimetype: 'image/png' })).rejects.toMatchObject({
      statusCode: 502,
      message: 'Storage upload failed: storage service timed out',
    });
  });
});

describe('supabase storage driver — destroy', () => {
  test('DELETEs the object via the bucket prefixes endpoint', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(okResponse([]));
    const driver = makeDriver(fetchImpl);

    await driver.destroy('products/abc-123.webp');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/storage/v1/object/${BUCKET}`);
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body)).toEqual({ prefixes: ['products/abc-123.webp'] });
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.headers.authorization).toBe(`Bearer ${SERVICE_KEY}`);
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
      jest.fn().mockResolvedValue(new Response(`denied for ${SERVICE_KEY}`, { status: 500 }))
    );

    const error = await driver.destroy('products/a.png').catch((caught) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(502);
    expect(error.message).toBe('Storage delete failed (500)');
    expect(exposedText(error)).not.toContain(SERVICE_KEY);
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
    expect(error.message).not.toContain(SERVICE_KEY);
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
