import { Alert, Steps } from 'antd';
import { formatDateTime } from '../../../utils/format';

/** Các bước thuận của vòng đời đơn (CLAUDE.md §7). */
const FLOW = ['PENDING', 'CONFIRMED', 'PACKING', 'SHIPPING', 'COMPLETED'];

const STEP_TITLE = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PACKING: 'Đang đóng gói',
  SHIPPING: 'Đang giao',
  COMPLETED: 'Hoàn thành',
};

/**
 * Đơn CANCELLED/RETURNED không nằm trên luồng thuận nên hiển thị bằng cảnh báo
 * riêng thay vì cố nhồi vào Steps.
 */
export default function OrderTimeline({ order }) {
  if (order.status === 'CANCELLED') {
    return (
      <Alert
        type="error"
        showIcon
        message="Đơn hàng đã bị hủy"
        description={
          <>
            {order.cancelled_reason ? `Lý do: ${order.cancelled_reason}` : 'Không có lý do ghi nhận'}
            <br />
            Tồn kho đã được cộng lại cho các sản phẩm trong đơn.
          </>
        }
      />
    );
  }

  if (order.status === 'RETURNED') {
    return (
      <Alert
        type="warning"
        showIcon
        message="Đơn hàng đã được trả lại"
        description={
          <>
            {order.cancelled_reason ? `Lý do: ${order.cancelled_reason}` : 'Không có lý do ghi nhận'}
            <br />
            Hàng đã nhập lại kho và đơn không còn tính vào tổng chi tiêu của khách.
          </>
        }
      />
    );
  }

  const current = FLOW.indexOf(order.status);

  return (
    <Steps
      current={current}
      status="process"
      responsive
      items={FLOW.map((status) => {
        const descriptions = {
          PENDING: formatDateTime(order.created_at),
          CONFIRMED: order.confirmed_at ? formatDateTime(order.confirmed_at) : undefined,
          COMPLETED: order.completed_at ? formatDateTime(order.completed_at) : undefined,
        };
        return { title: STEP_TITLE[status], description: descriptions[status] };
      })}
    />
  );
}
