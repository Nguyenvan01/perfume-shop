import { DatePicker, Flex, Segmented } from 'antd';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const PRESETS = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'this_month', label: 'Tháng này' },
  { value: 'custom', label: 'Tùy chọn' },
];

/**
 * Bộ lọc thời gian dùng chung cho Dashboard và Báo cáo.
 * Đặt trên một hàng phía trên các biểu đồ, không rải rác từng biểu đồ một.
 */
export default function RangeFilter({ value, onChange }) {
  const handlePreset = (range) => {
    if (range === 'custom') {
      // Mặc định 7 ngày gần nhất để người dùng có cái sửa, không để trống.
      onChange({
        range: 'custom',
        from: dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
        to: dayjs().format('YYYY-MM-DD'),
      });
      return;
    }
    onChange({ range });
  };

  return (
    <Flex gap={12} wrap align="center">
      <Segmented options={PRESETS} value={value.range ?? '30d'} onChange={handlePreset} />

      {value.range === 'custom' && (
        <RangePicker
          format="DD/MM/YYYY"
          allowClear={false}
          value={[
            value.from ? dayjs(value.from) : null,
            value.to ? dayjs(value.to) : null,
          ]}
          disabledDate={(current) => current && current > dayjs().endOf('day')}
          onChange={(dates) => {
            if (!dates?.[0] || !dates?.[1]) return;
            onChange({
              range: 'custom',
              from: dates[0].format('YYYY-MM-DD'),
              to: dates[1].format('YYYY-MM-DD'),
            });
          }}
        />
      )}
    </Flex>
  );
}
