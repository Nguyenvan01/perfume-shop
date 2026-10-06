import { Alert, Card } from 'antd';
import PageHeader from './PageHeader';

/**
 * Khung màn hình W1. Mỗi wave sau sẽ thay nội dung thật vào đúng file page này,
 * router không phải sửa lại.
 */
export default function PlaceholderPage({ title, subtitle, milestone }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Card>
        <Alert
          type="info"
          showIcon
          message={`Màn hình này được triển khai ở ${milestone}`}
          description="Khung route và layout đã sẵn sàng (W1 — Setup)."
        />
      </Card>
    </>
  );
}
