import { useEffect, useMemo, useState } from 'react';
import { App, Checkbox, Collapse, Form, Input, Modal, Typography } from 'antd';
import { rolesApi } from '../../../api/users';
import { handleMutationError } from '../../../utils/formErrors';

const { Text } = Typography;

/** Gom permission theo resource ("product.create" → nhóm "product") cho dễ chọn. */
function groupByResource(permissions) {
  return permissions.reduce((acc, permission) => {
    const [resource] = permission.code.split('.');
    acc[resource] = acc[resource] ?? [];
    acc[resource].push(permission);
    return acc;
  }, {});
}

export default function RoleFormModal({ open, role, permissions, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { notification } = App.useApp();
  const isEdit = Boolean(role);

  const grouped = useMemo(() => groupByResource(permissions), [permissions]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (role) {
      form.setFieldsValue({
        description: role.description ?? '',
        permission_ids: role.permission_ids ?? [],
      });
    }
  }, [open, role, form]);

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const payload = {
        description: values.description || undefined,
        permission_ids: values.permission_ids ?? [],
      };
      if (isEdit) {
        await rolesApi.update(role.id, payload);
        notification.success({ message: 'Cập nhật vai trò thành công' });
      } else {
        await rolesApi.create({ name: values.name, ...payload });
        notification.success({ message: 'Tạo vai trò thành công' });
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
      width={720}
      title={isEdit ? `Phân quyền cho vai trò: ${role.name}` : 'Thêm vai trò'}
      okText={isEdit ? 'Lưu' : 'Tạo'}
      cancelText="Hủy"
      confirmLoading={submitting}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
        {!isEdit && (
          <Form.Item
            name="name"
            label="Tên vai trò"
            extra="Chữ in hoa và dấu gạch dưới, ví dụ WAREHOUSE_STAFF"
            rules={[
              { required: true, message: 'Vui lòng nhập tên vai trò' },
              { pattern: /^[A-Z_]+$/, message: 'Chỉ dùng chữ in hoa và dấu gạch dưới' },
            ]}
          >
            <Input placeholder="WAREHOUSE_STAFF" />
          </Form.Item>
        )}

        <Form.Item name="description" label="Mô tả">
          <Input placeholder="Mô tả ngắn về vai trò" />
        </Form.Item>

        <Form.Item name="permission_ids" label="Quyền">
          <Checkbox.Group style={{ width: '100%' }}>
            <Collapse
              size="small"
              style={{ width: '100%' }}
              items={Object.entries(grouped).map(([resource, items]) => ({
                key: resource,
                label: (
                  <>
                    <Text strong>{resource}</Text> <Text type="secondary">({items.length})</Text>
                  </>
                ),
                children: items.map((permission) => (
                  <Checkbox
                    key={permission.id}
                    value={permission.id}
                    style={{ display: 'block', marginLeft: 0, marginBottom: 4 }}
                  >
                    {permission.code}
                  </Checkbox>
                )),
              }))}
            />
          </Checkbox.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
}
