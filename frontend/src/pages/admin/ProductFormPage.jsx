import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Col, Flex, Form, Input, Row, Select, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { productsApi } from '../../api/catalog';
import { PageHeader, LoadingState, ErrorState } from '../../components';
import { GENDER_LABEL, CONCENTRATION_LABEL, STATUS_LABEL } from '../../utils/constants';
import { handleMutationError } from '../../utils/formErrors';
import { useCatalogOptions } from '../../features/products/components/useCatalogOptions';
import VariantTable from '../../features/products/components/VariantTable';
import ProductImageUploader from '../../features/products/components/ProductImageUploader';

export default function ProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { brandOptions, categoryOptions } = useCatalogOptions();

  const productQuery = useQuery({
    queryKey: ['products', 'detail', id],
    queryFn: () => productsApi.detail(id),
    enabled: isEdit,
  });

  const product = productQuery.data;

  useEffect(() => {
    if (!product) return;
    form.setFieldsValue({
      name: product.name,
      slug: product.slug,
      brand_id: product.brand?.id,
      category_id: product.category?.id,
      gender: product.gender,
      concentration: product.concentration,
      origin: product.origin ?? '',
      fragrance_family: product.fragrance_family ?? '',
      description: product.description ?? '',
      status: product.status,
    });
  }, [product, form]);

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== '' && value !== undefined)
      );

      if (isEdit) {
        await productsApi.update(id, payload);
        notification.success({ message: 'Đã cập nhật sản phẩm' });
        queryClient.invalidateQueries({ queryKey: ['products'] });
      } else {
        const created = await productsApi.create(payload);
        notification.success({
          message: 'Đã tạo sản phẩm',
          description: 'Tiếp tục thêm biến thể dung tích và ảnh cho sản phẩm.',
        });
        queryClient.invalidateQueries({ queryKey: ['products'] });
        // Biến thể và ảnh cần product id → chuyển sang trang sửa ngay sau khi tạo.
        navigate(`/admin/products/${created.id}/edit`, { replace: true });
      }
    } catch (error) {
      handleMutationError({ error, form, notify: notification });
    } finally {
      setSubmitting(false);
    }
  };

  if (isEdit && productQuery.isPending) return <LoadingState rows={8} />;
  if (isEdit && productQuery.isError) {
    return <ErrorState error={productQuery.error} onRetry={productQuery.refetch} />;
  }

  return (
    <>
      <PageHeader
        title={isEdit ? `Sửa sản phẩm: ${product?.name}` : 'Thêm sản phẩm'}
        subtitle="Thông tin chung, biến thể dung tích và hình ảnh"
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/products')}>
            Về danh sách
          </Button>
        }
      />

      <Flex vertical gap={16}>
        <Card title="Thông tin chung">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            requiredMark={false}
            initialValues={{ status: 'ACTIVE', gender: 'UNISEX', concentration: 'EDP' }}
          >
            <Row gutter={16}>
              <Col xs={24} md={16}>
                <Form.Item
                  name="name"
                  label="Tên sản phẩm"
                  rules={[{ required: true, message: 'Vui lòng nhập tên sản phẩm' }]}
                >
                  <Input placeholder="Dior Sauvage Eau de Parfum" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="slug" label="Slug" extra="Để trống thì tự sinh từ tên">
                  <Input placeholder="tu-dong-sinh" />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  name="brand_id"
                  label="Thương hiệu"
                  rules={[{ required: true, message: 'Vui lòng chọn thương hiệu' }]}
                >
                  <Select placeholder="Chọn thương hiệu" options={brandOptions} showSearch optionFilterProp="label" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="category_id"
                  label="Danh mục"
                  rules={[{ required: true, message: 'Vui lòng chọn danh mục' }]}
                >
                  <Select placeholder="Chọn danh mục" options={categoryOptions} showSearch optionFilterProp="label" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="status" label="Trạng thái">
                  <Select
                    options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item name="gender" label="Giới tính" rules={[{ required: true }]}>
                  <Select
                    options={Object.entries(GENDER_LABEL).map(([value, label]) => ({ value, label }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="concentration" label="Nồng độ" rules={[{ required: true }]}>
                  <Select
                    options={Object.entries(CONCENTRATION_LABEL).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="origin" label="Xuất xứ">
                  <Input placeholder="Pháp" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="fragrance_family" label="Nhóm hương">
                  <Input placeholder="Woody Aromatic" />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item name="description" label="Mô tả">
                  <Input.TextArea rows={4} placeholder="Mô tả hương và cảm nhận" />
                </Form.Item>
              </Col>
            </Row>

            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {isEdit ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
              </Button>
              <Button onClick={() => navigate('/admin/products')}>Hủy</Button>
            </Space>
          </Form>
        </Card>

        {/* Biến thể và ảnh cần product id nên chỉ hiện ở chế độ sửa. */}
        {isEdit && (
          <>
            <Card title="Biến thể dung tích">
              <VariantTable
                productId={Number(id)}
                variants={product?.variants ?? []}
                onChanged={productQuery.refetch}
              />
            </Card>

            <Card title="Hình ảnh">
              <ProductImageUploader
                productId={Number(id)}
                images={product?.images ?? []}
                onChanged={productQuery.refetch}
              />
            </Card>
          </>
        )}
      </Flex>
    </>
  );
}
