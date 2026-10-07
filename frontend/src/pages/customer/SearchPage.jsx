import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { productsApi } from '../../api/catalog';
import { PageHeader } from '../../components';
import ProductGrid from '../../features/products/components/ProductGrid';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get('q') ?? '';
  const [page, setPage] = useState(1);

  const productsQuery = useQuery({
    queryKey: ['products', 'search', keyword, page],
    queryFn: () => productsApi.list({ q: keyword, page, limit: 12 }),
    enabled: keyword.length > 0,
  });

  const total = productsQuery.data?.meta?.total;

  return (
    <>
      <PageHeader
        title={keyword ? `Kết quả cho "${keyword}"` : 'Tìm kiếm'}
        subtitle={keyword && total !== undefined ? `${total} sản phẩm` : 'Nhập từ khóa để tìm'}
      />

      <Input.Search
        size="large"
        allowClear
        defaultValue={keyword}
        placeholder="Tên sản phẩm, thương hiệu, nhóm hương..."
        style={{ maxWidth: 520, marginBottom: 24 }}
        onSearch={(value) => {
          setPage(1);
          setSearchParams(value ? { q: value } : {});
        }}
      />

      {keyword && (
        <ProductGrid
          query={productsQuery}
          onChangePage={setPage}
          emptyDescription={`Không tìm thấy sản phẩm nào cho "${keyword}"`}
        />
      )}
    </>
  );
}
