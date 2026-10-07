import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Divider, Flex, List, Pagination, Rate, Select, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { reviewsApi } from '../../../api/reviews';
import { LoadingState, ErrorState, EmptyState } from '../../../components';
import { formatDateTime } from '../../../utils/format';
import { useAuth } from '../../auth/AuthContext';
import RatingSummary from './RatingSummary';
import ReviewForm from './ReviewForm';

const { Text, Paragraph } = Typography;

/** Lý do không đánh giá được → câu giải thích cho khách, không để họ đoán. */
const REASON_MESSAGE = {
  NOT_PURCHASED: 'Chỉ khách đã mua và nhận sản phẩm này mới đánh giá được.',
  NOT_CUSTOMER: 'Chỉ tài khoản khách hàng mới đánh giá được sản phẩm.',
};

export default function ProductReviews({ productId }) {
  const [page, setPage] = useState(1);
  const [ratingFilter, setRatingFilter] = useState(undefined);
  const [editing, setEditing] = useState(false);
  const { isAuthenticated, isCustomer } = useAuth();
  const queryClient = useQueryClient();

  const reviewsQuery = useQuery({
    queryKey: ['reviews', productId, page, ratingFilter],
    queryFn: () => reviewsApi.listByProduct(productId, { page, limit: 5, rating: ratingFilter }),
  });

  const eligibilityQuery = useQuery({
    queryKey: ['reviews', 'eligibility', productId],
    queryFn: () => reviewsApi.eligibility(productId),
    // Chỉ hỏi khi là khách hàng — admin/staff không có hồ sơ khách, backend trả 403.
    enabled: isCustomer,
    retry: false,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
    queryClient.invalidateQueries({ queryKey: ['reviews', 'eligibility', productId] });
    setEditing(false);
  };

  const eligibility = eligibilityQuery.data;
  const myReview = eligibility?.my_review;

  return (
    <Card title="Đánh giá sản phẩm" style={{ marginTop: 24 }}>
      {reviewsQuery.isPending ? (
        <LoadingState rows={4} />
      ) : reviewsQuery.isError ? (
        <ErrorState error={reviewsQuery.error} onRetry={reviewsQuery.refetch} />
      ) : (
        <>
          <RatingSummary summary={reviewsQuery.data.summary} />

          <Divider />

          {/* Khối gửi / sửa đánh giá của chính khách */}
          {!isAuthenticated && (
            <Alert
              type="info"
              showIcon
              message={
                <>
                  <Link to="/login">Đăng nhập</Link> để đánh giá sản phẩm bạn đã mua.
                </>
              }
              style={{ marginBottom: 16 }}
            />
          )}

          {isCustomer && eligibility?.can_review && (
            <>
              <ReviewForm
                productId={productId}
                purchase={eligibility.purchase}
                onSuccess={refresh}
              />
              <Divider />
            </>
          )}

          {isCustomer && myReview && (
            <>
              <Flex vertical gap={8} style={{ marginBottom: 8 }}>
                <Flex justify="space-between" align="center" wrap gap={8}>
                  <Text strong>Đánh giá của bạn</Text>
                  {!editing && (
                    <Button size="small" onClick={() => setEditing(true)}>
                      Sửa đánh giá
                    </Button>
                  )}
                </Flex>

                {editing ? (
                  <ReviewForm productId={productId} review={myReview} onSuccess={refresh} />
                ) : (
                  <Flex vertical gap={4}>
                    <Rate disabled value={myReview.rating} />
                    <Paragraph style={{ margin: 0 }}>{myReview.comment || '—'}</Paragraph>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatDateTime(myReview.created_at)}
                    </Text>
                  </Flex>
                )}
              </Flex>
              <Divider />
            </>
          )}

          {isCustomer && eligibility && !eligibility.can_review && !myReview && (
            <Alert
              type="info"
              showIcon
              message={REASON_MESSAGE[eligibility.reason] ?? 'Bạn chưa thể đánh giá sản phẩm này.'}
              style={{ marginBottom: 16 }}
            />
          )}

          <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 12 }}>
            <Text strong>Tất cả đánh giá</Text>
            <Select
              allowClear
              placeholder="Lọc theo số sao"
              style={{ width: 160 }}
              value={ratingFilter}
              options={[5, 4, 3, 2, 1].map((star) => ({ value: star, label: `${star} sao` }))}
              onChange={(value) => {
                setRatingFilter(value);
                setPage(1);
              }}
            />
          </Flex>

          {reviewsQuery.data.items.length === 0 ? (
            <EmptyState
              description={
                ratingFilter
                  ? `Chưa có đánh giá ${ratingFilter} sao`
                  : 'Sản phẩm chưa có đánh giá nào'
              }
            />
          ) : (
            <>
              <List
                dataSource={reviewsQuery.data.items}
                renderItem={(review) => (
                  <List.Item key={review.id}>
                    <Flex vertical gap={4} style={{ width: '100%' }}>
                      <Flex justify="space-between" align="center" wrap gap={8}>
                        <Flex align="center" gap={8}>
                          <Text strong>{review.customer?.full_name ?? 'Khách hàng'}</Text>
                          <Rate disabled value={review.rating} style={{ fontSize: 13 }} />
                        </Flex>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {formatDateTime(review.created_at)}
                        </Text>
                      </Flex>
                      {review.comment && (
                        <Paragraph style={{ margin: 0 }}>{review.comment}</Paragraph>
                      )}
                    </Flex>
                  </List.Item>
                )}
              />

              {reviewsQuery.data.meta?.total > reviewsQuery.data.meta?.limit && (
                <Flex justify="center" style={{ marginTop: 12 }}>
                  <Pagination
                    current={reviewsQuery.data.meta.page}
                    pageSize={reviewsQuery.data.meta.limit}
                    total={reviewsQuery.data.meta.total}
                    showSizeChanger={false}
                    onChange={setPage}
                  />
                </Flex>
              )}
            </>
          )}
        </>
      )}
    </Card>
  );
}
