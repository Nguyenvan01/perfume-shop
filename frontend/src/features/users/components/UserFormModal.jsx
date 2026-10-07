import { useEffect, useState } from 'react';
import { App, Form, Input, Modal, Select } from 'antd';
import { usersApi } from '../../../api/users';
import { handleMutationError } from '../../../utils/formErrors';
import { PASSWORD_RULES } from '../../auth/components/PasswordRules';

/** Modal dùng cho cả tạo mới và sửa — `user` null nghĩa là tạo mới. */
export default function UserFormModal({ open, user, roles, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { notification } = App.useApp();
  const isEdit = Boolean(user);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (user) {
      form.setFieldsValue({
        full_name: user.full_name,
        phone: user.phone ?? '',
        role_ids: roles.filter((role) => user.roles.includes(role.name)).map((role) => role.id),
      });
    }
  }, [open, user, roles, form]);

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      if (isEdit) {
        // Sửa thì không gửi email/password — backend không nhận 2 field này ở PUT.
        await usersApi.update(user.id, {
          full_name: values.full_name,
          phone: values.phone || undefined,
          role_ids: values.role_ids,
        });
        notification.success({ message: 'Cập nhật người dùng thành công' });
      } else {
        await usersApi.create({ ...values, phone: values.phone || undefined });
        notification.success({ message: 'Tạo người dùng thành công' });
      }
      onSuccess();
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
      title={isEdit ? `Sửa người dùng: ${user.email}` : 'Thêm người dùng'}
      okText={isEdit ? 'Lưu' : 'Tạo'}
      cancelText="Hủy"
      confirmLoading={submitting}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
        {!isEdit && (
          <>
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Vui lòng nhập email' },
                { type: 'email', message: 'Email không hợp lệ' },
              ]}
            >
              <Input placeholder="email@example.com" />
            </Form.Item>

            <Form.Item name="password" label="Mật khẩu" rules={PASSWORD_RULES}>
              <Input.Password placeholder="Tối thiểu 8 ký tự, có chữ và số" />
            </Form.Item>
          </>
        )}

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

        <Form.Item
          name="role_ids"
          label="Vai trò"
          rules={[{ required: true, message: 'Chọn ít nhất một vai trò' }]}
        >
          <Select
            mode="multiple"
            placeholder="Chọn vai trò"
            options={roles.map((role) => ({ value: role.id, label: role.name }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
