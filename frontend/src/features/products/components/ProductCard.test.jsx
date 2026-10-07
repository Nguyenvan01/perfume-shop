import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from './ProductCard';

const baseProduct = {
  id: 1,
  name: 'Dior Sauvage Eau de Parfum',
  slug: 'dior-sauvage-eau-de-parfum',
  brand: { id: 1, name: 'Dior' },
  gender: 'MALE',
  concentration: 'EDP',
  variant_count: 3,
  total_stock: 12,
  price_range: { min: 2150000, max: 4150000 },
  variants: [{ id: 1, sale_price: null }],
  images: [{ id: 1, image_url: '/uploads/a.png', is_primary: true }],
};

function renderCard(overrides = {}) {
  return render(
    <MemoryRouter>
      <ProductCard product={{ ...baseProduct, ...overrides }} />
    </MemoryRouter>
  );
}

describe('ProductCard', () => {
  it('hiện khoảng giá khi min khác max', () => {
    renderCard();
    expect(screen.getByText(/2\.150\.000/)).toBeInTheDocument();
    expect(screen.getByText(/4\.150\.000/)).toBeInTheDocument();
  });

  it('chỉ hiện một giá khi min bằng max', () => {
    renderCard({ price_range: { min: 2150000, max: 2150000 } });
    const priceText = screen.getByText(/2\.150\.000/);
    expect(priceText.textContent).not.toContain('–');
  });

  it('chưa có variant → hiện "Chưa có giá"', () => {
    renderCard({ price_range: null, variant_count: 0 });
    expect(screen.getByText('Chưa có giá')).toBeInTheDocument();
  });

  it('total_stock = 0 → gắn nhãn Hết hàng', () => {
    renderCard({ total_stock: 0 });
    expect(screen.getByText('Hết hàng')).toBeInTheDocument();
  });

  it('có variant giảm giá → gắn nhãn Giảm giá', () => {
    renderCard({ variants: [{ id: 1, sale_price: '1890000.00' }] });
    expect(screen.getByText('Giảm giá')).toBeInTheDocument();
  });

  it('link trỏ tới slug, không phải id', () => {
    renderCard();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/products/dior-sauvage-eau-de-parfum'
    );
  });

  it('nhãn enum hiển thị tiếng Việt', () => {
    renderCard();
    expect(screen.getByText(/EDP · Nam · 3 dung tích/)).toBeInTheDocument();
  });

  it('không có ảnh → hiện placeholder thay vì img lỗi', () => {
    renderCard({ images: [] });
    expect(screen.getByText('Chưa có ảnh')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
