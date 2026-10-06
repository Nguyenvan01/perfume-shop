import { Flex, Typography } from 'antd';

const { Title, Text } = Typography;

export default function PageHeader({ title, subtitle, extra }) {
  return (
    <Flex justify="space-between" align="flex-start" wrap gap={12} style={{ marginBottom: 20 }}>
      <div>
        <Title level={3} style={{ margin: 0 }}>
          {title}
        </Title>
        {subtitle && <Text type="secondary">{subtitle}</Text>}
      </div>
      {extra}
    </Flex>
  );
}
