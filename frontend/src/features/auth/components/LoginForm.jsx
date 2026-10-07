import { useState } from 'react';
import { App, Button, Form, Input, Typography } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { handleMutationError } from '../../../utils/formErrors';
import { ROLES } from '../../../utils/constants';

const { Title, Text } = Typography;

export default function LoginForm() {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const user = await login(values);
      notification.success({ message: `Xin chào ${user.full_name}` });

      // Về đúng nơi user bị chặn trước đó; nếu không có thì về portal theo role.
      const from = location.state?.from;
      const isStaffOrAdmin = user.roles.some((role) =>
        [ROLES.ADMIN, ROLES.STAFF].includes(role)
      );
      navigate(from || (isStaffOrAdmin ? '/admin' : '/'), { replace: true });
    } catch (error) {
      handleMutationError({ error, form, notify: notification, fallback: 'Đăng nhập thất bại' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Title level={4}>Đăng nhập</Title>
      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Vui lòng nhập email' },
            { type: 'email', message: 'Email không hợp lệ' },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="email@example.com" autoComplete="email" />
        </Form.Item>

        <Form.Item
          name="password"
          label="Mật khẩu"
          rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Mật khẩu"
            autoComplete="current-password"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 12 }}>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            Đăng nhập
          </Button>
        </Form.Item>
      </Form>

      <Text type="secondary">
        <Link to="/forgot-password">Quên mật khẩu?</Link>
      </Text>
      <br />
      <Text type="secondary">
        Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
      </Text>
    </>
  );
}
