import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Form, Input, InputNumber, Modal, Statistic, Flex, Typography } from 'antd';
import { inventoryApi } from '../../../api/inventory';
import { handleMutationError } from '../../../utils/formErrors';
import { formatNumber } from '../../../utils/format';

const { Text } = Typography;

/**
 * Điều chỉnh kho về một con số sau kiểm kê (chỉ ADMIN).
 * Hiển thị rõ chênh lệch để người dùng thấy mình đang ghi nhận bao nhiêu.
 */
export default function AdjustmentModal({ open, row, onClose }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [newQuantity, setNewQuantity] = useState(null);
  const { notification } = App.useApp();
  const queryClient = useQueryClient();

  const current = row?.stock_quantity ?? 0;
  const delta = newQuantity == null ? 0 : newQuantity - current;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ new_quantity: current });
    setNewQuantity(current);
  }, [open, current, form]);

  const mutation = useMutation({ mutationFn: (payload) => inventoryApi.adjust(payload) });

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      await mutation.mutateAsync({
        variant_id: row.variant_id,
        new_quantity: values.new_quantity,
        note: values.note,
      });
      notification.success({ message: 'Đã điều chỉnh tồn kho' });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
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
      title="Điều chỉnh tồn kho"
      okText="Điều chỉnh"
      cancelText="Hủy"
      confirmLoading={submitting}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="Dùng khi số liệu kiểm kê thực tế khác với hệ thống"
        description="Hệ thống ghi lại phần chênh lệch kèm ghi chú, không ghi đè lịch sử."
      />

      {row && (
        <Flex gap={32} style={{ marginBottom: 16 }}>
          <Statistic title="Tồn hiện tại" value={current} />
          <Statistic
            title="Chênh lệch sẽ ghi nhận"
            value={delta > 0 ? `+${formatNumber(delta)}` : formatNumber(delta)}
            valueStyle={{ color: delta > 0 ? '#389e0d' : delta < 0 ? '#cf1322' : undefined }}
          />
        </Flex>
      )}

      {row && (
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          <code>{row.sku}</code> — {row.product_name} {row.volume_ml}ml
        </Text>
      )}

      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
        <Form.Item
          name="new_quantity"
          label="Số lượng thực tế sau kiểm kê"
          rules={[
            { required: true, message: 'Nhập số lượng thực tế' },
            {
              validator: (_rule, value) =>
                value === current
                  ? Promise.reject(new Error('Số lượng không đổi, không cần điều chỉnh'))
                  : Promise.resolve(),
            },
          ]}
        >
          <InputNumber
            min={0}
            max={1_000_000}
            style={{ width: '100%' }}
            onChange={(value) => setNewQuantity(value)}
          />
        </Form.Item>

        <Form.Item
          name="note"
          label="Lý do điều chỉnh"
          rules={[
            { required: true, message: 'Bắt buộc ghi lý do' },
            { min: 3, message: 'Lý do quá ngắn' },
          ]}
        >
          <Input.TextArea rows={3} placeholder="Ví dụ: Kiểm kê tháng 10, phát hiện thiếu 2 chai" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
