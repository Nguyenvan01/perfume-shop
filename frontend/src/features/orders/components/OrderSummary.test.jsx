import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderSummary from './OrderSummary';

describe('OrderSummary', () => {
  it('hiện đủ 4 dòng tiền với giá trị từ backend', () => {
    render(
      <OrderSummary
        subtotal="1000000.00"
        discountAmount="100000.00"
        shippingFee="30000.00"
        totalAmount="930000.00"
      />
    );

    // So khớp chính xác: /30\.000/ sẽ khớp cả "930.000" nên phải dùng exact text.
    const exact = (value) => (_content, element) =>
      element?.textContent?.replace(/\s/g, ' ').trim() === value;

    expect(screen.getByText('Tạm tính')).toBeInTheDocument();
    expect(screen.getAllByText(exact('1.000.000 ₫')).length).toBeGreaterThan(0);
    expect(screen.getByText(/− .*100\.000/)).toBeInTheDocument();
    expect(screen.getAllByText(exact('30.000 ₫')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(exact('930.000 ₫')).length).toBeGreaterThan(0);
  });

  it('không có giảm giá thì không hiện dấu trừ', () => {
    render(
      <OrderSummary subtotal="500000" discountAmount="0" shippingFee="30000" totalAmount="530000" />
    );
    expect(screen.queryByText(/−/)).not.toBeInTheDocument();
  });

  it('có mã giảm giá thì hiện mã trong nhãn', () => {
    render(
      <OrderSummary
        subtotal="1000000"
        discountAmount="100000"
        shippingFee="30000"
        totalAmount="930000"
        promotionCode="WELCOME10"
      />
    );
    expect(screen.getByText('Giảm giá (WELCOME10)')).toBeInTheDocument();
  });
});
