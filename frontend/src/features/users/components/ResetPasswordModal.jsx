import { useState } from 'react';
import { App, Form, Input, Modal, Typography } from 'antd';
import { usersApi } from '../../../api/users';
import { handleMutationError } from '../../../utils/formErrors';
import { PASSWORD_RULES } from '../../auth/components/PasswordRules';

const { Text } = Typography;

export default function ResetPasswordModal({ open, user, onClose }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { notification } = App.useApp();

  const handleSubmit = async ({ new_password }) => {
    setSubmitting(true);
    try {
      await usersApi.resetPassword(user.id, new_password);
      notification.success({
        message: 'Đặt lại mật khẩu thành công',
        description: 'Các phiên đăng nhập cũ của người dùng đã bị thu hồi.',
      });
      onClose();
    } catch (error) {
      handleMutationError({ error, form, notify: notification });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Đặt lại mật khẩu"
      okText="Đặt lại"
      cancelText="Hủy"
      confirmLoading={submitting}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Text type="secondary">
        Đặt mật khẩu mới cho <Text strong>{user?.email}</Text>. Người dùng sẽ phải đăng nhập lại.
      </Text>

      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
        <Form.Item name="new_password" label="Mật khẩu mới" rules={PASSWORD_RULES}>
          <Input.Password placeholder="Tối thiểu 8 ký tự, có chữ và số" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
