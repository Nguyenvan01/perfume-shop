import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Button, Flex, Form, Input, InputNumber, Modal, Select, Table, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { variantsApi } from '../../../api/catalog';
import { ConfirmButton, EmptyState } from '../../../components';
import { formatCurrency, formatNumber } from '../../../utils/format';
import { STATUS_LABEL } from '../../../utils/constants';
import { handleMutationError } from '../../../utils/formErrors';

/**
 * Quản lý biến thể dung tích của một sản phẩm.
 * `stock_quantity` chỉ hiển thị — tồn kho thay đổi qua module Tồn kho (M5),
 * backend cũng không nhận field này ở endpoint variant.
 */
export default function VariantTable({ productId, variants, onChanged }) {
  const [modal, setModal] = useState({ open: false, variant: null });
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const { notification } = App.useApp();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    onChanged?.();
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => variantsApi.remove(id),
    onSuccess: () => {
      notification.success({ message: 'Đã xóa biến thể' });
      invalidate();
    },
    onError: (error) => notification.error({ message: error.message }),
  });

  const openModal = (variant) => {
    setModal({ open: true, variant });
    form.resetFields();
    if (variant) {
      form.setFieldsValue({
        sku: variant.sku,
        volume_ml: variant.volume_ml,
        price: Number(variant.price),
        sale_price: variant.sale_price == null ? null : Number(variant.sale_price),
        status: variant.status,
      });
    }
  };

  const closeModal = () => setModal({ open: false, variant: null });

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const payload = { ...values, sale_price: values.sale_price ?? null };
      if (modal.variant) {
        await variantsApi.update(modal.variant.id, payload);
        notification.success({ message: 'Đã cập nhật biến thể' });
      } else {
        await variantsApi.create(productId, payload);
        notification.success({ message: 'Đã thêm biến thể' });
      }
      invalidate();
      closeModal();
    } catch (error) {
      handleMutationError({ error, form, notify: notification });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', render: (value) => <code>{value}</code> },
    {
      title: 'Dung tích',
      dataIndex: 'volume_ml',
      key: 'volume_ml',
      render: (value) => `${value} ml`,
    },
    {
      title: 'Giá niêm yết',
      dataIndex: 'price',
      key: 'price',
      align: 'right',
      render: formatCurrency,
    },
    {
      title: 'Giá bán',
      dataIndex: 'sale_price',
      key: 'sale_price',
      align: 'right',
      render: (value) => (value == null ? '—' : formatCurrency(value)),
    },
    {
      title: 'Tồn kho',
      dataIndex: 'stock_quantity',
      key: 'stock_quantity',
      align: 'right',
      render: (value) => (
        <Tag color={value === 0 ? 'red' : value <= 5 ? 'orange' : 'green'}>
          {formatNumber(value)}
        </Tag>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{STATUS_LABEL[status]}</Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_value, record) => (
        <Flex gap={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
            Sửa
          </Button>
          <ConfirmButton
            size="small"
            danger
            icon={<DeleteOutlined />}
            title="Xóa biến thể này?"
            description="Không xóa được nếu đã có lịch sử kho hoặc đã bán."
            loading={deleteMutation.isPending}
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            Xóa
          </ConfirmButton>
        </Flex>
      ),
    },
  ];

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
        <span>
          Tồn kho chỉ thay đổi qua mục <strong>Tồn kho</strong>, không sửa trực tiếp ở đây.
        </span>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
          Thêm biến thể
        </Button>
      </Flex>

      <Table
        size="small"
        rowKey="id"
        columns={columns}
        dataSource={variants}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: <EmptyState description="Sản phẩm chưa có biến thể dung tích nào" />,
        }}
      />

      <Modal
        open={modal.open}
        title={modal.variant ? `Sửa biến thể ${modal.variant.sku}` : 'Thêm biến thể'}
        okText={modal.variant ? 'Lưu' : 'Thêm'}
        cancelText="Hủy"
        confirmLoading={submitting}
        onCancel={closeModal}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
          initialValues={{ status: 'ACTIVE' }}
        >
          <Form.Item
            name="sku"
            label="SKU"
            extra="Duy nhất toàn hệ thống"
            rules={[
              { required: true, message: 'Vui lòng nhập SKU' },
              { pattern: /^[A-Za-z0-9._-]+$/, message: 'Chỉ dùng chữ, số và . _ -' },
            ]}
          >
            <Input placeholder="DIOR-SAUV-EDP-100" />
          </Form.Item>

          <Form.Item
            name="volume_ml"
            label="Dung tích (ml)"
            rules={[{ required: true, message: 'Vui lòng nhập dung tích' }]}
          >
            <InputNumber min={1} max={10000} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="price"
            label="Giá niêm yết (VND)"
            rules={[{ required: true, message: 'Vui lòng nhập giá' }]}
          >
            <InputNumber
              min={0}
              step={10000}
              style={{ width: '100%' }}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
              parser={(value) => value.replace(/\./g, '')}
            />
          </Form.Item>

          <Form.Item
            name="sale_price"
            label="Giá bán (để trống nếu không giảm giá)"
            dependencies={['price']}
            rules={[
              ({ getFieldValue }) => ({
                validator: (_rule, value) =>
                  value == null || value <= getFieldValue('price')
                    ? Promise.resolve()
                    : Promise.reject(new Error('Giá bán không được cao hơn giá niêm yết')),
              }),
            ]}
          >
            <InputNumber
              min={0}
              step={10000}
              style={{ width: '100%' }}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
              parser={(value) => value.replace(/\./g, '')}
            />
          </Form.Item>

          <Form.Item name="status" label="Trạng thái">
            <Select
              options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
