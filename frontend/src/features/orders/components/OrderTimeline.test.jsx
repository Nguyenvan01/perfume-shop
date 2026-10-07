import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderTimeline from './OrderTimeline';

const baseOrder = {
  status: 'PENDING',
  created_at: '2026-10-07T03:00:00.000Z',
  confirmed_at: null,
  completed_at: null,
  cancelled_reason: null,
};

describe('OrderTimeline', () => {
  it('đơn đang xử lý hiện đủ 5 bước của vòng đời thuận', () => {
    render(<OrderTimeline order={baseOrder} />);
    for (const label of ['Chờ xác nhận', 'Đã xác nhận', 'Đang đóng gói', 'Đang giao', 'Hoàn thành']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('đơn đã hủy hiện cảnh báo kèm lý do, không hiện các bước', () => {
    render(
      <OrderTimeline
        order={{ ...baseOrder, status: 'CANCELLED', cancelled_reason: 'Khách đổi ý' }}
      />
    );
    expect(screen.getByText('Đơn hàng đã bị hủy')).toBeInTheDocument();
    expect(screen.getByText(/Khách đổi ý/)).toBeInTheDocument();
    expect(screen.queryByText('Đang đóng gói')).not.toBeInTheDocument();
  });

  it('đơn trả hàng nói rõ hàng đã nhập lại kho', () => {
    render(
      <OrderTimeline order={{ ...baseOrder, status: 'RETURNED', cancelled_reason: 'Không đúng mùi' }} />
    );
    expect(screen.getByText('Đơn hàng đã được trả lại')).toBeInTheDocument();
    expect(screen.getByText(/nhập lại kho/)).toBeInTheDocument();
  });

  it('đơn hủy không có lý do vẫn hiển thị được', () => {
    render(<OrderTimeline order={{ ...baseOrder, status: 'CANCELLED' }} />);
    expect(screen.getByText(/Không có lý do ghi nhận/)).toBeInTheDocument();
  });
});
