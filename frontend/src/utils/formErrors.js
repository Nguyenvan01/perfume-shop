/**
 * Đổ `errors[]` từ backend vào AntD Form để lỗi hiện ngay dưới đúng field.
 * Backend trả field dạng "body.email" hoặc "email" (xem implementation_plan.md §2).
 */
export function applyApiErrorsToForm(form, error) {
  const fieldErrors = error?.errors ?? [];
  if (fieldErrors.length === 0) return false;

  const fields = fieldErrors
    .filter((item) => item.field)
    .map((item) => ({
      name: item.field.replace(/^(body|query|params)\./, '').split('.'),
      errors: [item.message],
    }));

  if (fields.length === 0) return false;

  form.setFields(fields);
  return true;
}

/**
 * Xử lý lỗi mutation một chỗ: lỗi theo field thì gắn vào form,
 * còn lại thì hiện notification. Trả message đã dùng để caller log nếu cần.
 */
export function handleMutationError({ error, form, notify, fallback = 'Đã có lỗi xảy ra' }) {
  const attached = form ? applyApiErrorsToForm(form, error) : false;
  const message = error?.message || fallback;
  if (!attached) notify?.error({ message });
  return message;
}
