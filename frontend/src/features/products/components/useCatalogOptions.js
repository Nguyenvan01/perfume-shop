import { useQuery } from '@tanstack/react-query';
import { brandsApi, categoriesApi } from '../../../api/catalog';

const toOptions = (items) => items.map((item) => ({ value: item.id, label: item.name }));

/** Brand + category để đổ vào Select — dùng ở form admin và filter trang khách. */
export function useCatalogOptions() {
  const brandsQuery = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: () => brandsApi.list({ limit: 100, status: 'ACTIVE' }),
    staleTime: 5 * 60 * 1000,
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'options'],
    queryFn: () => categoriesApi.list({ limit: 100, status: 'ACTIVE' }),
    staleTime: 5 * 60 * 1000,
  });

  const brands = brandsQuery.data?.items ?? [];
  const categories = categoriesQuery.data?.items ?? [];

  return {
    brands,
    categories,
    brandOptions: toOptions(brands),
    categoryOptions: toOptions(categories),
    isLoading: brandsQuery.isPending || categoriesQuery.isPending,
  };
}
