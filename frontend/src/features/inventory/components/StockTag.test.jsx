import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import StockTag from './StockTag';

describe('StockTag', () => {
  it('tồn kho 0 → "Hết hàng"', () => {
    render(<StockTag quantity={0} />);
    expect(screen.getByText('Hết hàng')).toBeInTheDocument();
  });

  it('tồn kho dưới hoặc bằng ngưỡng → cảnh báo kèm số lượng', () => {
    render(<StockTag quantity={3} threshold={5} />);
    expect(screen.getByText('Còn 3')).toBeInTheDocument();
  });

  it('đúng bằng ngưỡng vẫn tính là sắp hết', () => {
    render(<StockTag quantity={5} threshold={5} />);
    expect(screen.getByText('Còn 5')).toBeInTheDocument();
  });

  it('trên ngưỡng → chỉ hiện số, định dạng tiếng Việt', () => {
    render(<StockTag quantity={1234} threshold={5} />);
    expect(screen.getByText('1.234')).toBeInTheDocument();
  });

  it('ngưỡng truyền vào được tôn trọng', () => {
    render(<StockTag quantity={8} threshold={10} />);
    expect(screen.getByText('Còn 8')).toBeInTheDocument();
  });
});
