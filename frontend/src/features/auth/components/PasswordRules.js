/** Rule mật khẩu dùng chung cho register / reset / change — khớp backend (>=8, có chữ + số). */
export const PASSWORD_RULES = [
  { required: true, message: 'Vui lòng nhập mật khẩu' },
  { min: 8, message: 'Mật khẩu tối thiểu 8 ký tự' },
  { pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, message: 'Mật khẩu phải có cả chữ và số' },
];

/** Rule "nhập lại mật khẩu" khớp với field tên `fieldName`. */
export const confirmPasswordRules = (fieldName) => [
  { required: true, message: 'Vui lòng nhập lại mật khẩu' },
  ({ getFieldValue }) => ({
    validator: (_rule, value) =>
      !value || getFieldValue(fieldName) === value
        ? Promise.resolve()
        : Promise.reject(new Error('Mật khẩu nhập lại không khớp')),
  }),
];
