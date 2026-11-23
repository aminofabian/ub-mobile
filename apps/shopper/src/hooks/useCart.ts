import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addCartLine, createCart, getCart } from '../api/storefront';
import { cartIdKey } from '../lib/shop-storage';

export function useCart(slug: string | undefined) {
  const queryClient = useQueryClient();

  const cartIdQuery = useQuery({
    queryKey: ['cartId', slug],
    queryFn: async () => {
      if (!slug) return null;
      const stored = await AsyncStorage.getItem(cartIdKey(slug));
      return stored;
    },
    enabled: !!slug,
  });

  const cartQuery = useQuery({
    queryKey: ['cart', slug, cartIdQuery.data],
    queryFn: () => getCart(slug!, cartIdQuery.data!),
    enabled: !!slug && !!cartIdQuery.data,
  });

  const setLineQty = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      if (!slug) throw new Error('No tenant');

      let cartId = cartIdQuery.data;
      if (!cartId) {
        const newCart = await createCart(slug);
        cartId = newCart.id;
        if (cartId) {
          await AsyncStorage.setItem(cartIdKey(slug), cartId);
        }
      }

      if (!cartId) throw new Error('Failed to create cart');

      return addCartLine(slug, cartId, { itemId, quantity: Math.max(0, quantity) });
    },
    onSuccess: (updatedCart) => {
      if (updatedCart.id) {
        queryClient.setQueryData(['cartId', slug], updatedCart.id);
        queryClient.setQueryData(['cart', slug, updatedCart.id], updatedCart);
      }
      queryClient.invalidateQueries({ queryKey: ['cart', slug] });
      queryClient.invalidateQueries({ queryKey: ['cartId', slug] });
    },
  });

  const addToCart = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const current =
        cartQuery.data?.lines?.find((line) => line.itemId === itemId)?.quantity ?? 0;
      return setLineQty.mutateAsync({ itemId, quantity: current + quantity });
    },
  });

  const lines = cartQuery.data?.lines ?? [];
  const itemCount = lines.reduce((sum, line) => sum + (line.quantity ?? 0), 0);

  function quantityFor(itemId: string): number {
    return lines.find((line) => line.itemId === itemId)?.quantity ?? 0;
  }

  return {
    cart: cartQuery.data,
    cartId: cartIdQuery.data,
    isLoading: cartQuery.isLoading || cartIdQuery.isLoading,
    addToCart,
    setLineQty,
    itemCount,
    quantityFor,
  };
}
