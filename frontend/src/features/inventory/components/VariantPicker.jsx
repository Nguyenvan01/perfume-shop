import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, Space, Typography } from 'antd';
import { inventoryApi } from '../../../api/inventory';
import { formatNumber } from '../../../utils/format';

const { Text } = Typography;

/**
 * Chọn biến thể theo SKU hoặc tên sản phẩm, hiện kèm tồn kho hiện tại để người
 * nhập liệu thấy ngay con số trước khi nhập/xuất.
 */
export default function VariantPicker({ value, onChange, excludeIds = [], placeholder }) {
  const [keyword, setKeyword] = useState('');

  const variantsQuery = useQuery({
    queryKey: ['inventory', 'picker', keyword],
    queryFn: () => inventoryApi.list({ q: keyword, limit: 20 }),
  });

  const options = (variantsQuery.data?.items ?? [])
    .filter((row) => !excludeIds.includes(row.variant_id))
    .map((row) => ({
      value: row.variant_id,
      label: `${row.sku} — ${row.product_name} ${row.volume_ml}ml`,
      stock: row.stock_quantity,
    }));

  return (
    <Select
      showSearch
      value={value}
      placeholder={placeholder ?? 'Tìm theo SKU hoặc tên sản phẩm'}
      style={{ width: '100%' }}
      filterOption={false}
      loading={variantsQuery.isFetching}
      notFoundContent={variantsQuery.isFetching ? 'Đang tìm...' : 'Không tìm thấy biến thể'}
      onSearch={setKeyword}
      onChange={onChange}
      options={options}
      optionRender={(option) => (
        <Space>
          <span>{option.data.label}</span>
          <Text type="secondary">tồn: {formatNumber(option.data.stock)}</Text>
        </Space>
      )}
    />
  );
}
