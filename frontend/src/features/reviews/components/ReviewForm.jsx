import { useEffect, useState } from 'react';
import { App, Button, Flex, Form, Input, Rate, Typography } from 'antd';
import { reviewsApi } from '../../../api/reviews';
import { handleMutationError } from '../../../utils/formErrors';

const { Text } = Typography;

const RATING_HINT = ['', 'Rất không hài lòng', 'Không hài lòng', 'Bình thường', 'Hài lòng', 'Rất hài lòng'];

/** `review` khác null nghĩa là đang sửa đánh giá đã có của chính mình. */
export default function ReviewForm({ productId, review, purchase, onSuccess }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(review?.rating ?? 0);
  const { notification } = App.useApp();
  const isEdit = Boolean(review);

  useEffect(() => {
    if (review) {
      form.setFieldsValue({ rating: review.rating, comment: review.comment ?? '' });
      setRating(review.rating);
    }
  }, [review, form]);

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const payload = { rating: values.rating, comment: values.comment || undefined };
      if (isEdit) {
        await reviewsApi.update(review.id, payload);
        notification.success({ message: 'Đã cập nhật đánh giá' });
      } else {
        await reviewsApi.create(productId, payload);
        notification.success({ message: 'Cảm ơn bạn đã đánh giá' });
      }
      onSuccess();
    } catch (error) {
      handleMutationError({
        error,
        form,
        notify: notification,
        fallback: 'Không gửi được đánh giá',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
      {purchase && !isEdit && (
        <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
          Bạn đã mua sản phẩm này ở đơn <code>{purchase.order_code}</code>
        </Text>
      )}

      <Form.Item
        name="rating"
        label="Bạn thấy sản phẩm này thế nào?"
        rules={[{ required: true, message: 'Vui lòng chọn số sao' }]}
      >
        <Flex align="center" gap={12}>
          <Rate value={rating} onChange={(value) => { setRating(value); form.setFieldValue('rating', value); }} />
          {rating > 0 && <Text type="secondary">{RATING_HINT[rating]}</Text>}
        </Flex>
      </Form.Item>

      <Form.Item name="comment" label="Nhận xét" extra="Không bắt buộc, tối đa 2000 ký tự">
        <Input.TextArea
          rows={3}
          maxLength={2000}
          showCount
          placeholder="Mùi hương, độ lưu hương, cảm nhận khi dùng..."
        />
      </Form.Item>

      <Button type="primary" htmlType="submit" loading={submitting}>
        {isEdit ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
      </Button>
    </Form>
  );
}
