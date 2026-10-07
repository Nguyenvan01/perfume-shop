import { useState } from 'react';
import { App, Button, Form, Input } from 'antd';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../../api/auth';
import { useAuth } from '../AuthContext';
import { handleMutationError } from '../../../utils/formErrors';
import { PASSWORD_RULES, confirmPasswordRules } from './PasswordRules';

/**
 * Dùng chung cho cả customer và admin. Backend thu hồi toàn bộ session khi đổi
 * mật khẩu, nên sau khi đổi phải logout rồi cho đăng nhập lại.
 */
export default function ChangePasswordForm() {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { notification } = App.useApp();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async ({ confirm_password: _confirm, ...values }) => {
    setSubmitting(true);
    try {
      await authApi.changePassword(values);
      notification.success({
        message: 'Đổi mật khẩu thành công',
        description: 'Vui lòng đăng nhập lại bằng mật khẩu mới.',
      });
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      handleMutationError({
        error,
        form,
        notify: notification,
        fallback: 'Không đổi được mật khẩu',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      requiredMark={false}
      style={{ maxWidth: 420 }}
    >
      <Form.Item
        name="current_password"
        label="Mật khẩu hiện tại"
        rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}
      >
        <Input.Password autoComplete="current-password" />
      </Form.Item>

      <Form.Item name="new_password" label="Mật khẩu mới" rules={PASSWORD_RULES}>
        <Input.Password
          placeholder="Tối thiểu 8 ký tự, có chữ và số"
          autoComplete="new-password"
        />
      </Form.Item>

      <Form.Item
        name="confirm_password"
        label="Nhập lại mật khẩu mới"
        dependencies={['new_password']}
        rules={confirmPasswordRules('new_password')}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0 }}>
        <Button type="primary" htmlType="submit" loading={submitting}>
          Đổi mật khẩu
        </Button>
      </Form.Item>
    </Form>
  );
}
