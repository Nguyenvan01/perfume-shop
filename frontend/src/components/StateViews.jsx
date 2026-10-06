import { Alert, Button, Empty, Result, Skeleton, Spin } from 'antd';

/** Loading state dùng chung — `rows` > 0 thì dùng skeleton cho cảm giác mượt hơn spinner. */
export function LoadingState({ rows = 0, tip = 'Đang tải...' }) {
  if (rows > 0) {
    return <Skeleton active paragraph={{ rows }} title={false} />;
  }
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <Spin tip={tip} size="large" />
    </div>
  );
}

export function EmptyState({ description = 'Chưa có dữ liệu', action = null }) {
  return (
    <Empty description={description} image={Empty.PRESENTED_IMAGE_SIMPLE}>
      {action}
    </Empty>
  );
}

/** Error state — nhận ApiError hoặc Error thường; có nút thử lại nếu truyền onRetry. */
export function ErrorState({ error, onRetry, title = 'Không tải được dữ liệu' }) {
  const description = error?.message || 'Đã có lỗi xảy ra';
  const fieldErrors = error?.errors ?? [];

  return (
    <Alert
      type="error"
      showIcon
      message={title}
      description={
        <>
          <div>{description}</div>
          {fieldErrors.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {fieldErrors.map((item, index) => (
                <li key={index}>
                  {item.field ? `${item.field}: ` : ''}
                  {item.message}
                </li>
              ))}
            </ul>
          )}
        </>
      }
      action={
        onRetry ? (
          <Button size="small" danger onClick={onRetry}>
            Thử lại
          </Button>
        ) : null
      }
    />
  );
}

export function ForbiddenState() {
  return (
    <Result
      status="403"
      title="403"
      subTitle="Bạn không có quyền truy cập trang này."
    />
  );
}

/**
 * Bọc 3 trạng thái của một TanStack Query vào 1 chỗ, để màn hình nào cũng
 * có đủ loading / error / empty mà không lặp lại code (CLAUDE.md §4).
 */
export function QueryBoundary({ query, children, skeletonRows = 4, emptyDescription, isEmpty }) {
  if (query.isPending) return <LoadingState rows={skeletonRows} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const empty = typeof isEmpty === 'function' ? isEmpty(query.data) : false;
  if (empty) return <EmptyState description={emptyDescription} />;

  return children(query.data);
}
