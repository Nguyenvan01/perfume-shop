import { useEffect, useState } from 'react';
import { App, DatePicker, Form, Input, InputNumber, Modal, Radio, Select, Typography } from 'antd';
import dayjs from 'dayjs';
import { promotionsApi } from '../../../api/promotions';
import { handleMutationError } from '../../../utils/formErrors';
import { DISCOUNT_TYPE_LABEL, STATUS_LABEL } from '../../../utils/constants';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const moneyProps = {
  min: 0,
  style: { width: '100%' },
  formatter: (value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
  parser: (value) => value.replace(/\./g, ''),
};

export default function PromotionFormModal({ open, promotion, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [discountType, setDiscountType] = useState('PERCENTAGE');
  const { notification } = App.useApp();
  const isEdit = Boolean(promotion);

  useEffect(() => {
    if (!open) return;
    form.resetFields();

    if (promotion) {
      setDiscountType(promotion.discount_type);
      form.setFieldsValue({
        code: promotion.code,
        name: promotion.name,
        discount_type: promotion.discount_type,
        discount_value: Number(promotion.discount_value),
        minimum_order_value: Number(promotion.minimum_order_value),
        max_discount: promotion.max_discount == null ? null : Number(promotion.max_discount),
        period: [dayjs(promotion.start_date), dayjs(promotion.end_date)],
        usage_limit: promotion.usage_limit,
        per_customer_limit: promotion.per_customer_limit,
        status: promotion.status,
      });
    } else {
      setDiscountType('PERCENTAGE');
    }
  }, [open, promotion, form]);

  const handleSubmit = async ({ period, ...values }) => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        start_date: period[0].startOf('day').toISOString(),
        end_date: period[1].endOf('day').toISOString(),
        // max_discount chỉ có nghĩa với giảm theo %; backend từ chối nếu gửi kèm FIXED.
        max_discount: values.discount_type === 'PERCENTAGE' ? (values.max_discount ?? null) : null,
        usage_limit: values.usage_limit ?? null,
      };

      if (isEdit) {
        await promotionsApi.update(promotion.id, payload);
        notification.success({ message: 'Đã cập nhật khuyến mãi' });
      } else {
        await promotionsApi.create(payload);
        notification.success({ message: 'Đã tạo khuyến mãi' });
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
      width={640}
      title={isEdit ? `Sửa khuyến mãi: ${promotion.code}` : 'Thêm khuyến mãi'}
      okText={isEdit ? 'Lưu' : 'Tạo'}
      cancelText="Hủy"
      confirmLoading={submitting}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        initialValues={{
          discount_type: 'PERCENTAGE',
          minimum_order_value: 0,
          per_customer_limit: 1,
          status: 'ACTIVE',
          period: [dayjs(), dayjs().add(30, 'day')],
        }}
        onValuesChange={(changed) => {
          if (changed.discount_type) setDiscountType(changed.discount_type);
        }}
      >
        <Form.Item
          name="code"
          label="Mã giảm giá"
          extra="Chữ in hoa, số, dấu _ và -. Khách nhập mã này ở giỏ hàng."
          rules={[
            { required: true, message: 'Vui lòng nhập mã' },
            { min: 3, message: 'Mã quá ngắn' },
            { pattern: /^[A-Za-z0-9_-]+$/, message: 'Chỉ dùng chữ, số, _ và -' },
          ]}
        >
          <Input
            placeholder="WELCOME10"
            onChange={(event) => form.setFieldValue('code', event.target.value.toUpperCase())}
          />
        </Form.Item>

        <Form.Item
          name="name"
          label="Tên chương trình"
          rules={[
            { required: true, message: 'Vui lòng nhập tên' },
            { min: 3, message: 'Tên quá ngắn' },
          ]}
        >
          <Input placeholder="Giảm 10% cho đơn đầu tiên" />
        </Form.Item>

        <Form.Item name="discount_type" label="Kiểu giảm giá" rules={[{ required: true }]}>
          <Radio.Group
            options={Object.entries(DISCOUNT_TYPE_LABEL).map(([value, label]) => ({
              value,
              label,
            }))}
            optionType="button"
          />
        </Form.Item>

        <Form.Item
          name="discount_value"
          label={discountType === 'PERCENTAGE' ? 'Phần trăm giảm (%)' : 'Số tiền giảm (VND)'}
          rules={[
            { required: true, message: 'Vui lòng nhập giá trị' },
            discountType === 'PERCENTAGE'
              ? { type: 'number', min: 1, max: 100, message: 'Phần trăm phải từ 1 đến 100' }
              : { type: 'number', min: 1, message: 'Số tiền phải lớn hơn 0' },
          ]}
        >
          {discountType === 'PERCENTAGE' ? (
            <InputNumber min={1} max={100} style={{ width: '100%' }} addonAfter="%" />
          ) : (
            <InputNumber {...moneyProps} step={10000} />
          )}
        </Form.Item>

        {discountType === 'PERCENTAGE' && (
          <Form.Item
            name="max_discount"
            label="Giảm tối đa (VND)"
            extra="Để trống nếu không giới hạn mức giảm"
          >
            <InputNumber {...moneyProps} step={10000} />
          </Form.Item>
        )}

        <Form.Item
          name="minimum_order_value"
          label="Giá trị đơn tối thiểu (VND)"
          extra="Đơn phải đạt mức này mới áp được mã"
        >
          <InputNumber {...moneyProps} step={100000} />
        </Form.Item>

        <Form.Item
          name="period"
          label="Thời gian hiệu lực"
          rules={[{ required: true, message: 'Vui lòng chọn khoảng thời gian' }]}
        >
          <RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="usage_limit"
          label="Tổng số lượt dùng"
          extra={
            isEdit ? (
              <Text type="secondary">
                Đã dùng {promotion.used_count} lượt — không hạ xuống dưới số này được.
              </Text>
            ) : (
              'Để trống nếu không giới hạn'
            )
          }
        >
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="per_customer_limit"
          label="Số lượt mỗi khách"
          rules={[{ required: true, message: 'Vui lòng nhập số lượt' }]}
        >
          <InputNumber min={1} max={100} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="status" label="Trạng thái">
          <Select
            options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
