import { Table } from 'antd';
import { EmptyState } from './StateViews';

/**
 * Table + pagination theo contract `meta` của backend (§2).
 * `onChangePage(page, limit)` để parent cập nhật query params.
 */
export default function DataTable({
  columns,
  dataSource,
  meta,
  loading,
  onChangePage,
  rowKey = 'id',
  emptyDescription = 'Chưa có dữ liệu',
  ...rest
}) {
  return (
    <Table
      columns={columns}
      dataSource={dataSource}
      rowKey={rowKey}
      loading={loading}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: <EmptyState description={emptyDescription} /> }}
      pagination={
        meta
          ? {
              current: meta.page,
              pageSize: meta.limit,
              total: meta.total,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              showTotal: (total, range) => `${range[0]}–${range[1]} / ${total} bản ghi`,
              onChange: onChangePage,
            }
          : false
      }
      {...rest}
    />
  );
}
