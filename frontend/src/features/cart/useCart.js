import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { cartApi } from '../../api/cart';
import { useAuth } from '../auth/AuthContext';

export const CART_QUERY_KEY = ['cart'];

/**
 * Nguồn dữ liệu giỏ hàng dùng chung: header badge, trang giỏ, trang chi tiết
 * sản phẩm. Chỉ fetch khi user là CUSTOMER — backend trả 403 với admin/staff.
 */
export function useCart() {
  const { isCustomer } = useAuth();
  const queryClient = useQueryClient();
  const { notification } = App.useApp();

  const cartQuery = useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn: cartApi.get,
    enabled: isCustomer,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });

  const onError = (error) => notification.error({ message: error.message });

  const addItem = useMutation({
    mutationFn: ({ variantId, quantity }) =>
      cartApi.addItem({ variant_id: variantId, quantity }),
    onSuccess: () => {
      notification.success({ message: 'Đã thêm vào giỏ hàng' });
      invalidate();
    },
    onError,
  });

  const updateItem = useMutation({
    mutationFn: ({ itemId, quantity }) => cartApi.updateItem(itemId, quantity),
    onSuccess: invalidate,
    onError,
  });

  const removeItem = useMutation({
    mutationFn: (itemId) => cartApi.removeItem(itemId),
    onSuccess: () => {
      notification.success({ message: 'Đã xóa khỏi giỏ hàng' });
      invalidate();
    },
    onError,
  });

  const clearCart = useMutation({
    mutationFn: cartApi.clear,
    onSuccess: () => {
      notification.success({ message: 'Đã xóa toàn bộ giỏ hàng' });
      invalidate();
    },
    onError,
  });

  const cart = cartQuery.data;

  return {
    cartQuery,
    cart,
    itemCount: cart?.item_count ?? 0,
    totalQuantity: cart?.total_quantity ?? 0,
    hasWarnings: (cart?.warnings?.length ?? 0) > 0,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    invalidate,
  };
}
