import { useState } from 'react';
import { App, Button, Form, Input, Typography } from 'antd';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../../api/auth';
import { handleMutationError } from '../../../utils/formErrors';
import { PASSWORD_RULES, confirmPasswordRules } from './PasswordRules';

const { Title, Text, Paragraph } = Typography;

export default function ResetPasswordForm() {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const { notification } = App.useApp();
  const navigate = useNavigate();

  const handleSubmit = async ({ confirm_password: _confirm, ...values }) => {
    setSubmitting(true);
    try {
      await authApi.resetPassword(values);
      notification.success({ message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' });
      navigate('/login', { replace: true });
    } catch (error) {
      handleMutationError({
        error,
        form,
        notify: notification,
        fallback: 'Không đặt lại được mật khẩu',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Title level={4}>Đặt lại mật khẩu</Title>
      <Paragraph type="secondary">Nhập token nhận được và mật khẩu mới.</Paragraph>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        initialValues={{ token: searchParams.get('token') ?? '' }}
      >
        <Form.Item
          name="token"
          label="Token"
          rules={[{ required: true, message: 'Vui lòng nhập token' }]}
        >
          <Input.TextArea rows={2} placeholder="Token nhận được từ email" />
        </Form.Item>

        <Form.Item name="new_password" label="Mật khẩu mới" rules={PASSWORD_RULES}>
          <Input.Password placeholder="Tối thiểu 8 ký tự, có chữ và số" autoComplete="new-password" />
        </Form.Item>

        <Form.Item
          name="confirm_password"
          label="Nhập lại mật khẩu mới"
          dependencies={['new_password']}
          rules={confirmPasswordRules('new_password')}
        >
          <Input.Password placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 12 }}>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            Đặt lại mật khẩu
          </Button>
        </Form.Item>
      </Form>

      <Text type="secondary">
        <Link to="/login">Quay lại đăng nhập</Link>
      </Text>
    </>
  );
}
