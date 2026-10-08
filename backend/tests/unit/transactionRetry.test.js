'use strict';

const { Prisma } = require('@prisma/client');
const AppError = require('../../src/utils/AppError');
const { isTransactionConflict, runTransactionWithRetry } = require('../../src/utils/transaction');
const { errorHandler } = require('../../src/middleware/error.middleware');

const prismaError = (code, meta) =>
  new Prisma.PrismaClientKnownRequestError(`fake ${code}`, { code, clientVersion: 'test', meta });

const writeConflict = () => prismaError('P2034');
const rawDeadlock = () => prismaError('P2010', { code: '40P01', message: 'deadlock detected' });

/** Client giả: lần gọi thứ i của $transaction ném outcomes[i] (nếu là Error) hoặc trả về nó. */
function fakeClient(outcomes) {
  const $transaction = jest.fn(async (fn) => {
    const outcome = outcomes[$transaction.mock.calls.length - 1];
    if (outcome instanceof Error) throw outcome;
    return outcome === undefined ? fn('tx') : outcome;
  });
  return { $transaction };
}

const noWait = () => Promise.resolve();

describe('isTransactionConflict', () => {
  it('nhận P2034 và P2010 mang SQLSTATE deadlock / serialization', () => {
    expect(isTransactionConflict(writeConflict())).toBe(true);
    expect(isTransactionConflict(rawDeadlock())).toBe(true);
    expect(isTransactionConflict(prismaError('P2010', { code: '40001' }))).toBe(true);
  });

  it('không nhận lỗi khác', () => {
    expect(isTransactionConflict(prismaError('P2010', { code: '23505' }))).toBe(false);
    expect(isTransactionConflict(prismaError('P2002', { target: ['sku'] }))).toBe(false);
    expect(isTransactionConflict(AppError.conflict('Cart is empty'))).toBe(false);
    expect(isTransactionConflict(new Error('boom'))).toBe(false);
    expect(isTransactionConflict(undefined)).toBe(false);
  });
});

describe('runTransactionWithRetry', () => {
  it('thành công ngay → chạy 1 lần, trả kết quả của fn', async () => {
    const client = fakeClient([]);
    const result = await runTransactionWithRetry(async (tx) => `ok:${tx}`, { client, wait: noWait });

    expect(result).toBe('ok:tx');
    expect(client.$transaction).toHaveBeenCalledTimes(1);
  });

  it('deadlock / write conflict rồi thành công → retry và trả kết quả', async () => {
    const client = fakeClient([rawDeadlock(), writeConflict()]);
    const wait = jest.fn(noWait);

    const result = await runTransactionWithRetry(async () => 42, { client, wait });

    expect(result).toBe(42);
    expect(client.$transaction).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
    // Backoff tăng dần: lần 2 chờ lâu hơn hẳn mức tối thiểu của lần 1.
    const [[first], [second]] = wait.mock.calls;
    expect(first).toBeGreaterThanOrEqual(25);
    expect(first).toBeLessThan(50);
    expect(second).toBeGreaterThanOrEqual(50);
  });

  it('xung đột mãi → dừng sau maxAttempts, ném AppError 409 (không phải 500)', async () => {
    const client = fakeClient([writeConflict(), writeConflict(), writeConflict(), writeConflict()]);

    const promise = runTransactionWithRetry(async () => 'never', { client, wait: noWait });

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({ statusCode: 409 });
    expect(client.$transaction).toHaveBeenCalledTimes(3);
  });

  it('tôn trọng maxAttempts tùy chỉnh', async () => {
    const client = fakeClient([writeConflict(), writeConflict()]);
    await expect(
      runTransactionWithRetry(async () => 1, { client, wait: noWait, maxAttempts: 2 })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(client.$transaction).toHaveBeenCalledTimes(2);
  });

  it('lỗi nghiệp vụ / lỗi khác → ném nguyên vẹn, không retry', async () => {
    const business = AppError.unprocessable('Insufficient stock');
    const client = fakeClient([business]);
    await expect(runTransactionWithRetry(async () => 1, { client, wait: noWait })).rejects.toBe(business);
    expect(client.$transaction).toHaveBeenCalledTimes(1);

    const unique = prismaError('P2002', { target: ['sku'] });
    const client2 = fakeClient([unique]);
    await expect(runTransactionWithRetry(async () => 1, { client: client2, wait: noWait })).rejects.toBe(unique);
    expect(client2.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('errorHandler — deadlock / write conflict lọt ra ngoài → 409', () => {
  const run = (error) => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    errorHandler(error, {}, res, () => {});
    return res;
  };

  it.each([
    ['P2034', writeConflict()],
    ['P2010/40P01', rawDeadlock()],
  ])('%s → 409', (_label, error) => {
    const res = run(error);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0]).toMatchObject({ success: false });
  });
});
