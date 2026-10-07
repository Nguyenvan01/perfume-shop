import { useState } from 'react';
import { App, Button, Form, Input } from 'antd';
import { authApi } from '../../../api/auth';
import { useAuth } from '../AuthContext';
import { handleMutationError } from '../../../utils/formErrors';

export default function ProfileForm({ profile }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { notification } = App.useApp();
  const { setUser, isCustomer } = useAuth();

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const updated = await authApi.updateProfile(values);
      setUser(updated);
      notification.success({ message: 'Cập nhật hồ sơ thành công' });
    } catch (error) {
      handleMutationError({ error, form, notify: notification, fallback: 'Không cập nhật được' });
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
      style={{ maxWidth: 480 }}
      initialValues={{
        full_name: profile?.full_name ?? '',
        phone: profile?.phone ?? '',
        address: profile?.address ?? '',
      }}
    >
      <Form.Item label="Email">
        {/* Email là danh tính đăng nhập — không cho sửa ở đây. */}
        <Input value={profile?.email} disabled />
      </Form.Item>

      <Form.Item
        name="full_name"
        label="Họ và tên"
        rules={[
          { required: true, message: 'Vui lòng nhập họ tên' },
          { min: 2, message: 'Họ tên quá ngắn' },
        ]}
      >
        <Input />
      </Form.Item>

      <Form.Item
        name="phone"
        label="Số điện thoại"
        rules={[{ pattern: /^0\d{8,10}$/, message: 'Số điện thoại không hợp lệ' }]}
      >
        <Input placeholder="0901234567" />
      </Form.Item>

      {/* address thuộc bảng customers — tài khoản ADMIN/STAFF không có field này. */}
      {isCustomer && (
        <Form.Item name="address" label="Địa chỉ">
          <Input.TextArea rows={2} placeholder="Số nhà, đường, quận, thành phố" />
        </Form.Item>
      )}

      <Form.Item style={{ marginBottom: 0 }}>
        <Button type="primary" htmlType="submit" loading={submitting}>
          Lưu thay đổi
        </Button>
      </Form.Item>
    </Form>
  );
}
