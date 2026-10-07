import { describe, expect, it, vi } from 'vitest';
import { applyApiErrorsToForm, handleMutationError } from './formErrors';

function makeForm() {
  return { setFields: vi.fn() };
}

describe('applyApiErrorsToForm', () => {
  it('bỏ tiền tố "body." trong field name của backend', () => {
    const form = makeForm();
    const applied = applyApiErrorsToForm(form, {
      errors: [{ field: 'body.email', message: 'Email is invalid' }],
    });

    expect(applied).toBe(true);
    expect(form.setFields).toHaveBeenCalledWith([
      { name: ['email'], errors: ['Email is invalid'] },
    ]);
  });

  it('xử lý field lồng nhau thành path array', () => {
    const form = makeForm();
    applyApiErrorsToForm(form, {
      errors: [{ field: 'body.items.0.quantity', message: 'Quantity is invalid' }],
    });

    expect(form.setFields).toHaveBeenCalledWith([
      { name: ['items', '0', 'quantity'], errors: ['Quantity is invalid'] },
    ]);
  });

  it('lỗi không có field → không gắn vào form', () => {
    const form = makeForm();
    const applied = applyApiErrorsToForm(form, { errors: [{ message: 'Validation failed' }] });

    expect(applied).toBe(false);
    expect(form.setFields).not.toHaveBeenCalled();
  });

  it('không có errors → không làm gì', () => {
    const form = makeForm();
    expect(applyApiErrorsToForm(form, { message: 'Conflict' })).toBe(false);
    expect(form.setFields).not.toHaveBeenCalled();
  });
});

describe('handleMutationError', () => {
  it('lỗi theo field thì gắn vào form, không bật notification', () => {
    const form = makeForm();
    const notify = { error: vi.fn() };

    handleMutationError({
      error: { message: 'Validation failed', errors: [{ field: 'email', message: 'Sai email' }] },
      form,
      notify,
    });

    expect(form.setFields).toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('lỗi chung (409, 401) thì bật notification', () => {
    const notify = { error: vi.fn() };

    handleMutationError({
      error: { message: 'Email already registered', errors: [] },
      form: makeForm(),
      notify,
    });

    expect(notify.error).toHaveBeenCalledWith({ message: 'Email already registered' });
  });

  it('dùng fallback khi error không có message', () => {
    const notify = { error: vi.fn() };
    handleMutationError({ error: {}, notify, fallback: 'Đăng nhập thất bại' });
    expect(notify.error).toHaveBeenCalledWith({ message: 'Đăng nhập thất bại' });
  });
});
