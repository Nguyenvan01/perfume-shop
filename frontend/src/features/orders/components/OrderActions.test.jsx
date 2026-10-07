import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App as AntdApp, ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OrderActions from './OrderActions';
import * as authContext from '../../auth/AuthContext';

function renderActions(order, { isAdmin = true } = {}) {
  vi.spyOn(authContext, 'useAuth').mockReturnValue({ isAdmin });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <ConfigProvider>
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <OrderActions order={order} />
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
}

const order = (status, transitions, payment = { status: 'UNPAID' }) => ({
  id: 1,
  status,
  allowed_transitions: transitions,
  payment,
});

describe('OrderActions — chỉ hiện hành động mà API cho phép', () => {
  it('đơn PENDING: hiện Xác nhận và Hủy, không hiện bước sau', () => {
    renderActions(order('PENDING', ['CONFIRMED', 'CANCELLED']));

    expect(screen.getByRole('button', { name: /Xác nhận đơn/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hủy đơn/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Giao cho vận chuyển/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hoàn thành đơn/ })).not.toBeInTheDocument();
  });

  it('đơn PACKING: chỉ còn bước giao hàng, không hủy được nữa', () => {
    renderActions(order('PACKING', ['SHIPPING']));

    expect(screen.getByRole('button', { name: /Giao cho vận chuyển/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hủy đơn/ })).not.toBeInTheDocument();
  });

  it('đơn COMPLETED: chỉ còn xử lý trả hàng', () => {
    renderActions(order('COMPLETED', ['RETURNED'], { status: 'PAID' }));

    expect(screen.getByRole('button', { name: /Xử lý trả hàng/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hủy đơn/ })).not.toBeInTheDocument();
  });

  it('STAFF không thấy nút trả hàng (backend cũng trả 403)', () => {
    renderActions(order('COMPLETED', ['RETURNED'], { status: 'PAID' }), { isAdmin: false });
    expect(screen.queryByRole('button', { name: /Xử lý trả hàng/ })).not.toBeInTheDocument();
  });

  it('đơn đã kết thúc: không còn thao tác nào', () => {
    renderActions(order('CANCELLED', []));
    expect(screen.getByRole('button', { name: /Đơn đã kết thúc/ })).toBeDisabled();
  });

  it('đơn chưa thu tiền: hiện nút Đã thu tiền', () => {
    renderActions(order('CONFIRMED', ['PACKING', 'CANCELLED'], { status: 'UNPAID' }));
    expect(screen.getByRole('button', { name: /Đã thu tiền/ })).toBeInTheDocument();
  });

  it('đơn đã thu tiền: ẩn nút Đã thu tiền', () => {
    renderActions(order('CONFIRMED', ['PACKING', 'CANCELLED'], { status: 'PAID' }));
    expect(screen.queryByRole('button', { name: /Đã thu tiền/ })).not.toBeInTheDocument();
  });

  it('allowed_transitions thiếu → không nổ, coi như đơn đã kết thúc', () => {
    renderActions({ id: 1, status: 'PENDING', payment: null });
    expect(screen.getByRole('button', { name: /Đơn đã kết thúc/ })).toBeInTheDocument();
  });
});
