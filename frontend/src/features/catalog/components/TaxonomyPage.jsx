import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Flex, Form, Input, Modal, Select, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { PageHeader, DataTable, ErrorState, ConfirmButton } from '../../../components';
import { formatDateTime } from '../../../utils/format';
import { STATUS_LABEL } from '../../../utils/constants';
import { handleMutationError } from '../../../utils/formErrors';

/**
 * Brand và Category có cùng hình dạng CRUD (name, slug, description, status).
 * Dùng chung một màn hình để không lặp logic; `extraColumns` và `extraFields`
 * lo phần khác biệt (brand có logo).
 */
export default function TaxonomyPage({
  title,
  subtitle,
  entityLabel,
  api,
  queryKey,
  extraColumns = [],
  extraFields = null,
  renderModalExtra = null,
}) {
  const [params, setParams] = useState({ page: 1, limit: 10, q: '', status: undefined });
  const [modal, setModal] = useState({ open: false, record: null });
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const { notification } = App.useApp();
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: [queryKey, params],
    queryFn: () => api.list(params),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [queryKey] });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.remove(id),
    onSuccess: () => {
      notification.success({ message: `Đã xóa ${entityLabel}` });
      invalidate();
    },
    onError: (error) => notification.error({ message: error.message }),
  });

  const openModal = (record) => {
    setModal({ open: true, record });
    form.resetFields();
    if (record) {
      form.setFieldsValue({
        name: record.name,
        slug: record.slug,
        description: record.description ?? '',
        status: record.status,
      });
    }
  };

  const closeModal = () => setModal({ open: false, record: null });

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        slug: values.slug || undefined,
        description: values.description || undefined,
      };
      if (modal.record) {
        await api.update(modal.record.id, payload);
        notification.success({ message: `Đã cập nhật ${entityLabel}` });
      } else {
        await api.create(payload);
        notification.success({ message: `Đã thêm ${entityLabel}` });
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
    { title: 'Tên', dataIndex: 'name', key: 'name' },
    { title: 'Slug', dataIndex: 'slug', key: 'slug', render: (value) => <code>{value}</code> },
    ...extraColumns,
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (value) => value || '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{STATUS_LABEL[status]}</Tag>
      ),
    },
    { title: 'Cập nhật', dataIndex: 'updated_at', key: 'updated_at', render: formatDateTime },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      render: (_value, record) => (
        <Flex gap={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
            Sửa
          </Button>
          <ConfirmButton
            size="small"
            danger
            icon={<DeleteOutlined />}
            title={`Xóa ${entityLabel} này?`}
            description={`Không xóa được nếu còn sản phẩm thuộc ${entityLabel}.`}
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
      <PageHeader
        title={title}
        subtitle={subtitle}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
            Thêm {entityLabel}
          </Button>
        }
      />

      <Flex gap={12} wrap style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder={`Tìm theo tên ${entityLabel}`}
          allowClear
          style={{ maxWidth: 300 }}
          onSearch={(value) => setParams((prev) => ({ ...prev, q: value, page: 1 }))}
        />
        <Select
          placeholder="Trạng thái"
          allowClear
          style={{ width: 180 }}
          options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(value) => setParams((prev) => ({ ...prev, status: value, page: 1 }))}
        />
      </Flex>

      {listQuery.isError ? (
        <ErrorState error={listQuery.error} onRetry={listQuery.refetch} />
      ) : (
        <DataTable
          columns={columns}
          dataSource={listQuery.data?.items ?? []}
          meta={listQuery.data?.meta}
          loading={listQuery.isFetching}
          emptyDescription={`Chưa có ${entityLabel} nào`}
          onChangePage={(page, limit) => setParams((prev) => ({ ...prev, page, limit }))}
        />
      )}

      <Modal
        open={modal.open}
        title={modal.record ? `Sửa ${entityLabel}: ${modal.record.name}` : `Thêm ${entityLabel}`}
        okText={modal.record ? 'Lưu' : 'Tạo'}
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
            name="name"
            label="Tên"
            rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="slug" label="Slug" extra="Để trống thì hệ thống tự sinh từ tên">
            <Input placeholder="tu-dong-sinh" />
          </Form.Item>

          {extraFields}

          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item name="status" label="Trạng thái">
            <Select
              options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
        </Form>

        {modal.record && renderModalExtra?.(modal.record)}
      </Modal>
    </>
  );
}
