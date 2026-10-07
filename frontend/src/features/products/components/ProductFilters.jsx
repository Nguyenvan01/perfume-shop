import { Button, Card, Flex, InputNumber, Radio, Select, Slider, Switch, Typography } from 'antd';
import { GENDER_LABEL, CONCENTRATION_LABEL } from '../../../utils/constants';
import { useCatalogOptions } from './useCatalogOptions';

const { Text } = Typography;

const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'Mới nhất' },
  { value: 'price:asc', label: 'Giá thấp → cao' },
  { value: 'price:desc', label: 'Giá cao → thấp' },
  { value: 'name:asc', label: 'Tên A → Z' },
];

const MAX_PRICE = 10_000_000;

/** Sidebar filter cho trang danh sách sản phẩm phía khách. */
export default function ProductFilters({ value, onChange, onReset }) {
  const { brandOptions, categoryOptions } = useCatalogOptions();

  const set = (patch) => onChange({ ...value, ...patch, page: 1 });

  return (
    <Flex vertical gap={16}>
      <Card size="small" title="Sắp xếp">
        <Select
          style={{ width: '100%' }}
          value={value.sort ?? 'created_at:desc'}
          options={SORT_OPTIONS}
          onChange={(sort) => set({ sort })}
        />
      </Card>

      <Card size="small" title="Thương hiệu">
        <Select
          allowClear
          placeholder="Tất cả thương hiệu"
          style={{ width: '100%' }}
          value={value.brand_id}
          options={brandOptions}
          onChange={(brand_id) => set({ brand_id })}
        />
      </Card>

      <Card size="small" title="Danh mục">
        <Select
          allowClear
          placeholder="Tất cả danh mục"
          style={{ width: '100%' }}
          value={value.category_id}
          options={categoryOptions}
          onChange={(category_id) => set({ category_id })}
        />
      </Card>

      <Card size="small" title="Giới tính">
        <Radio.Group
          value={value.gender ?? ''}
          onChange={(event) => set({ gender: event.target.value || undefined })}
        >
          <Flex vertical gap={4}>
            <Radio value="">Tất cả</Radio>
            {Object.entries(GENDER_LABEL).map(([key, label]) => (
              <Radio key={key} value={key}>
                {label}
              </Radio>
            ))}
          </Flex>
        </Radio.Group>
      </Card>

      <Card size="small" title="Nồng độ">
        <Select
          allowClear
          placeholder="Tất cả nồng độ"
          style={{ width: '100%' }}
          value={value.concentration}
          options={Object.entries(CONCENTRATION_LABEL).map(([key, label]) => ({
            value: key,
            label,
          }))}
          onChange={(concentration) => set({ concentration })}
        />
      </Card>

      <Card size="small" title="Khoảng giá">
        <Slider
          range
          min={0}
          max={MAX_PRICE}
          step={100_000}
          value={[value.min_price ?? 0, value.max_price ?? MAX_PRICE]}
          tooltip={{ formatter: (price) => `${(price / 1_000_000).toFixed(1)} tr` }}
          onChangeComplete={([min, max]) =>
            set({
              min_price: min > 0 ? min : undefined,
              max_price: max < MAX_PRICE ? max : undefined,
            })
          }
        />
        <Flex gap={8} align="center">
          <InputNumber
            size="small"
            min={0}
            max={MAX_PRICE}
            style={{ width: '100%' }}
            value={value.min_price ?? null}
            placeholder="Từ"
            onChange={(min_price) => set({ min_price: min_price ?? undefined })}
          />
          <Text type="secondary">—</Text>
          <InputNumber
            size="small"
            min={0}
            max={MAX_PRICE}
            style={{ width: '100%' }}
            value={value.max_price ?? null}
            placeholder="Đến"
            onChange={(max_price) => set({ max_price: max_price ?? undefined })}
          />
        </Flex>
      </Card>

      <Card size="small">
        <Flex justify="space-between" align="center">
          <Text>Chỉ hàng còn sẵn</Text>
          <Switch
            checked={value.in_stock === 'true'}
            onChange={(checked) => set({ in_stock: checked ? 'true' : undefined })}
          />
        </Flex>
      </Card>

      <Button onClick={onReset}>Xóa tất cả lọc</Button>
    </Flex>
  );
}
