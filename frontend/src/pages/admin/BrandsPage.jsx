import { Avatar } from 'antd';
import { brandsApi } from '../../api/catalog';
import TaxonomyPage from '../../features/catalog/components/TaxonomyPage';
import { resolveImageUrl } from '../../utils/imageUrl';

export default function BrandsPage() {
  return (
    <TaxonomyPage
      title="Quản lý thương hiệu"
      subtitle="Thương hiệu nước hoa đang bán"
      entityLabel="thương hiệu"
      api={brandsApi}
      queryKey="brands"
      extraColumns={[
        {
          title: 'Logo',
          dataIndex: 'logo_url',
          key: 'logo_url',
          width: 80,
          render: (logoUrl, record) => (
            <Avatar src={resolveImageUrl(logoUrl)} shape="square" size={40}>
              {record.name?.[0]}
            </Avatar>
          ),
        },
      ]}
    />
  );
}
