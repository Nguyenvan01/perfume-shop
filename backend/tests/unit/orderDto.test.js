'use strict';

const { toOrderDTO, toOrderListDTO, buildOrderCode } = require('../../src/modules/orders/order.service');

const fullOrder = {
  id: 7,
  order_code: 'PS20261007-00007',
  status: 'PENDING',
  customer_id: 3,
  customer: { id: 3, user: { full_name: 'Nguyễn Văn A', email: 'a@test.local', phone: '0901234567' } },
  details: [{ id: 1, sku: 'ABC-100', quantity: 2 }],
  payment: { method: 'COD', status: 'UNPAID', amount: '530000.00', paid_at: null },
  promotion: { id: 1, code: 'SALE10', name: 'Giảm 10%' },
};

describe('toOrderDTO', () => {
  it('gộp phẳng thông tin khách, không lộ cấu trúc user lồng nhau', () => {
    const dto = toOrderDTO(fullOrder);
    expect(dto.customer).toEqual({
      id: 3,
      full_name: 'Nguyễn Văn A',
      email: 'a@test.local',
      phone: '0901234567',
    });
    expect(dto.customer).not.toHaveProperty('user');
  });

  it('đính kèm allowed_transitions để frontend không phải tự suy luận', () => {
    expect(toOrderDTO(fullOrder).allowed_transitions.sort()).toEqual(['CANCELLED', 'CONFIRMED']);
  });

  it('order null → null, không throw', () => {
    expect(toOrderDTO(null)).toBeNull();
    expect(toOrderDTO(undefined)).toBeNull();
  });

  it('đơn đọc thiếu quan hệ: customer/payment/promotion null, details về mảng rỗng', () => {
    const dto = toOrderDTO({ id: 1, status: 'PENDING' });
    expect(dto.customer).toBeNull();
    expect(dto.payment).toBeNull();
    expect(dto.promotion).toBeNull();
    expect(dto.details).toEqual([]);
    expect(dto.item_count).toBe(0);
  });

  it('item_count đếm theo số dòng chi tiết', () => {
    expect(toOrderDTO(fullOrder).item_count).toBe(1);
  });

  it('trạng thái cuối → allowed_transitions rỗng', () => {
    expect(toOrderDTO({ ...fullOrder, status: 'CANCELLED' }).allowed_transitions).toEqual([]);
  });
});

describe('toOrderListDTO', () => {
  it('bỏ details, giữ item_count từ _count', () => {
    const dto = toOrderListDTO({
      id: 1,
      status: 'PENDING',
      customer: { id: 3, user: { full_name: 'A', email: 'a@test.local' } },
      payment: { method: 'COD', status: 'UNPAID' },
      _count: { details: 4 },
    });

    expect(dto).not.toHaveProperty('details');
    expect(dto.item_count).toBe(4);
    expect(dto.customer).toEqual({ id: 3, full_name: 'A', email: 'a@test.local' });
  });

  it('thiếu _count và quan hệ → 0 và null, không throw', () => {
    const dto = toOrderListDTO({ id: 1, status: 'PENDING' });
    expect(dto.item_count).toBe(0);
    expect(dto.customer).toBeNull();
    expect(dto.payment).toBeNull();
  });
});

describe('buildOrderCode', () => {
  it('sinh mã từ ngày tạo và id, pad 5 chữ số', () => {
    expect(buildOrderCode(7, new Date('2026-10-07T03:00:00.000Z'))).toBe('PS20261007-00007');
    expect(buildOrderCode(12345, new Date('2026-01-01T00:00:00.000Z'))).toBe('PS20260101-12345');
  });

  it('id lớn vẫn vừa trong VarChar(32)', () => {
    expect(buildOrderCode(999_999_999, new Date('2026-10-07T00:00:00.000Z')).length).toBeLessThanOrEqual(32);
  });

  it('id khác nhau cho mã khác nhau — không thể trùng', () => {
    const date = new Date('2026-10-07T00:00:00.000Z');
    const codes = [1, 2, 3, 100, 99999].map((id) => buildOrderCode(id, date));
    expect(new Set(codes).size).toBe(codes.length);
  });
});
