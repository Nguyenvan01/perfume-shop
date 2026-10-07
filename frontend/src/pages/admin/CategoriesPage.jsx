import { categoriesApi } from '../../api/catalog';
import TaxonomyPage from '../../features/catalog/components/TaxonomyPage';

export default function CategoriesPage() {
  return (
    <TaxonomyPage
      title="Quản lý danh mục"
      subtitle="Nhóm sản phẩm theo đối tượng và loại"
      entityLabel="danh mục"
      api={categoriesApi}
      queryKey="categories"
    />
  );
}
