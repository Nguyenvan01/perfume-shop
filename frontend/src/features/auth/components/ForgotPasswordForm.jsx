import { useState } from 'react';
import { Alert, App, Button, Form, Input, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { authApi } from '../../../api/auth';
import { handleMutationError } from '../../../utils/formErrors';

const { Title, Text, Paragraph } = Typography;

export default function ForgotPasswordForm() {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState(null);
  const { notification } = App.useApp();

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const data = await authApi.forgotPassword(values);
      setSent(true);
      // Dev chưa gửi email thật (OD-6) — backend trả token để test luồng reset.
      setDevToken(data?.reset_token ?? null);
    } catch (error) {
      handleMutationError({ error, form, notify: notification });
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <>
        <Title level={4}>Kiểm tra email</Title>
        <Paragraph type="secondary">
          Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đi.
        </Paragraph>

        {devToken && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Môi trường development"
            description={
              <>
                <Paragraph style={{ marginBottom: 8 }}>
                  Hệ thống chưa gửi email thật. Dùng token dưới đây ở trang đặt lại mật khẩu:
                </Paragraph>
                <Text code copyable style={{ wordBreak: 'break-all' }}>
                  {devToken}
                </Text>
              </>
            }
          />
        )}

        <Link to={devToken ? `/reset-password?token=${devToken}` : '/reset-password'}>
          <Button type="primary" block>
            Tới trang đặt lại mật khẩu
          </Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <Title level={4}>Quên mật khẩu</Title>
      <Paragraph type="secondary">Nhập email đã đăng ký để nhận hướng dẫn đặt lại mật khẩu.</Paragraph>

      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
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

        <Form.Item style={{ marginBottom: 12 }}>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            Gửi yêu cầu
          </Button>
        </Form.Item>
      </Form>

      <Text type="secondary">
        <Link to="/login">Quay lại đăng nhập</Link>
      </Text>
    </>
  );
}
