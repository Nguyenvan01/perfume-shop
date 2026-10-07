import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Flex, Form, Input, InputNumber, Modal, Space } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { inventoryApi } from '../../../api/inventory';
import { handleMutationError } from '../../../utils/formErrors';
import VariantPicker from './VariantPicker';

const COPY = {
  IMPORT: {
    title: 'Nhập kho',
    okText: 'Nhập kho',
    hint: 'Mỗi biến thể chỉ xuất hiện một lần trong một phiếu. Cả phiếu cùng thành công hoặc cùng thất bại.',
    successMessage: 'Đã nhập kho',
  },
  EXPORT: {
    title: 'Xuất kho',
    okText: 'Xuất kho',
    hint: 'Không xuất vượt quá tồn kho hiện có. Nếu một dòng thiếu hàng thì cả phiếu bị từ chối.',
    successMessage: 'Đã xuất kho',
  },
};

/** Phiếu nhập/xuất nhiều dòng. Dùng chung cho cả hai vì chỉ khác chữ và endpoint. */
export default function StockMovementModal({ open, type, onClose }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const { notification } = App.useApp();
  const queryClient = useQueryClient();

  const copy = COPY[type] ?? COPY.IMPORT;

  useEffect(() => {
    if (open) {
      form.resetFields();
      setSelectedIds([]);
    }
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: (payload) =>
      type === 'IMPORT' ? inventoryApi.importStock(payload) : inventoryApi.exportStock(payload),
  });

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      await mutation.mutateAsync({
        items: values.items.map((item) => ({
          variant_id: item.variant_id,
          quantity: item.quantity,
        })),
        note: values.note || undefined,
      });
      notification.success({ message: copy.successMessage });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    } catch (error) {
      handleMutationError({ error, form, notify: notification, fallback: 'Thao tác kho thất bại' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      width={720}
      title={copy.title}
      okText={copy.okText}
      cancelText="Hủy"
      confirmLoading={submitting}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Alert type="info" showIcon message={copy.hint} style={{ marginBottom: 16 }} />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        initialValues={{ items: [{}] }}
        onValuesChange={(_changed, all) =>
          setSelectedIds((all.items ?? []).map((item) => item?.variant_id).filter(Boolean))
        }
      >
        <Form.List name="items">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Flex key={key} gap={8} align="flex-start">
                  <Form.Item
                    {...restField}
                    name={[name, 'variant_id']}
                    label={name === 0 ? 'Biến thể' : null}
                    style={{ flex: 1 }}
                    rules={[{ required: true, message: 'Chọn biến thể' }]}
                  >
                    <VariantPicker
                      excludeIds={selectedIds.filter(
                        (id) => id !== form.getFieldValue(['items', name, 'variant_id'])
                      )}
                    />
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    name={[name, 'quantity']}
                    label={name === 0 ? 'Số lượng' : null}
                    rules={[{ required: true, message: 'Nhập số lượng' }]}
                  >
                    <InputNumber min={1} max={1_000_000} style={{ width: 130 }} />
                  </Form.Item>

                  <Form.Item label={name === 0 ? ' ' : null}>
                    <Button
                      type="text"
                      danger
                      icon={<MinusCircleOutlined />}
                      disabled={fields.length === 1}
                      onClick={() => remove(name)}
                    />
                  </Form.Item>
                </Flex>
              ))}

              <Form.Item>
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>
                  Thêm dòng
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>

        <Form.Item name="note" label="Ghi chú">
          <Input.TextArea rows={2} placeholder="Lý do nhập/xuất, số phiếu, nhà cung cấp..." />
        </Form.Item>

        <Space />
      </Form>
    </Modal>
  );
}
