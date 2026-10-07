import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import RatingSummary from './RatingSummary';

const summary = (overrides = {}) => ({
  average: 4,
  total: 4,
  breakdown: [
    { rating: 5, count: 2 },
    { rating: 4, count: 1 },
    { rating: 3, count: 0 },
    { rating: 2, count: 1 },
    { rating: 1, count: 0 },
  ],
  ...overrides,
});

describe('RatingSummary', () => {
  it('hiện điểm trung bình một chữ số thập phân', () => {
    render(<RatingSummary summary={summary({ average: 4.67 })} />);
    expect(screen.getByText('4.7')).toBeInTheDocument();
  });

  it('hiện đủ 5 bậc sao kể cả bậc có 0 đánh giá', () => {
    render(<RatingSummary summary={summary()} />);
    for (const star of [1, 2, 3, 4, 5]) {
      expect(screen.getByText(`${star} sao`)).toBeInTheDocument();
    }
  });

  it('chưa có đánh giá → hiện thông báo, không hiện 0.0 gây nhầm', () => {
    render(<RatingSummary summary={summary({ average: 0, total: 0 })} />);
    expect(screen.getByText('Chưa có đánh giá nào')).toBeInTheDocument();
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
  });

  it('summary null không làm component nổ', () => {
    render(<RatingSummary summary={null} />);
    expect(screen.getByText('Chưa có đánh giá nào')).toBeInTheDocument();
  });

  it('hiện tổng số đánh giá theo định dạng tiếng Việt', () => {
    render(<RatingSummary summary={summary({ total: 1234 })} />);
    expect(screen.getByText('1.234 đánh giá')).toBeInTheDocument();
  });
});
