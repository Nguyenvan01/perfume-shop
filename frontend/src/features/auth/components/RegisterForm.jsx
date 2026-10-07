import { useState } from 'react';
import { App, Button, Form, Input, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { handleMutationError } from '../../../utils/formErrors';
import { PASSWORD_RULES, confirmPasswordRules } from './PasswordRules';

const { Title, Text } = Typography;

export default function RegisterForm() {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const { notification } = App.useApp();
  const navigate = useNavigate();

  const handleSubmit = async ({ confirm_password: _confirm, ...values }) => {
    setSubmitting(true);
    try {
      await register(values);
      notification.success({ message: 'Đăng ký thành công' });
      navigate('/', { replace: true });
    } catch (error) {
      handleMutationError({ error, form, notify: notification, fallback: 'Đăng ký thất bại' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Title level={4}>Đăng ký</Title>
      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
        <Form.Item
          name="full_name"
          label="Họ và tên"
          rules={[
            { required: true, message: 'Vui lòng nhập họ tên' },
            { min: 2, message: 'Họ tên quá ngắn' },
          ]}
        >
          <Input placeholder="Nguyễn Văn A" />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Vui lòng nhập email' },
            { type: 'email', message: 'Email không hợp lệ' },
          ]}
        >
          <Input placeholder="email@example.com" autoComplete="email" />
        </Form.Item>

        <Form.Item
          name="phone"
          label="Số điện thoại"
          rules={[{ pattern: /^0\d{8,10}$/, message: 'Số điện thoại không hợp lệ' }]}
        >
          <Input placeholder="0901234567" />
        </Form.Item>

        <Form.Item name="address" label="Địa chỉ">
          <Input placeholder="Số nhà, đường, quận, thành phố" />
        </Form.Item>

        <Form.Item name="password" label="Mật khẩu" rules={PASSWORD_RULES}>
          <Input.Password placeholder="Tối thiểu 8 ký tự, có chữ và số" autoComplete="new-password" />
        </Form.Item>

        <Form.Item
          name="confirm_password"
          label="Nhập lại mật khẩu"
          dependencies={['password']}
          rules={confirmPasswordRules('password')}
        >
          <Input.Password placeholder="Nhập lại mật khẩu" autoComplete="new-password" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 12 }}>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            Đăng ký
          </Button>
        </Form.Item>
      </Form>

      <Text type="secondary">
        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
      </Text>
    </>
  );
}
