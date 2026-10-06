import { Button, Popconfirm } from 'antd';

/**
 * Action nguy hiểm (xóa, hủy đơn, khóa user) buộc phải confirm — CLAUDE.md §4.
 */
export default function ConfirmButton({
  title = 'Xác nhận thao tác?',
  description,
  onConfirm,
  okText = 'Đồng ý',
  cancelText = 'Hủy',
  loading,
  children,
  ...buttonProps
}) {
  return (
    <Popconfirm
      title={title}
      description={description}
      okText={okText}
      cancelText={cancelText}
      okButtonProps={{ loading }}
      onConfirm={onConfirm}
    >
      <Button {...buttonProps}>{children}</Button>
    </Popconfirm>
  );
}
