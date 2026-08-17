import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addCartLine, createCart, getCart } from '../api/storefront';

const CART_ID_KEY = 'kiosk.shopper.cartId';

export function useCart(slug: string | undefined) {
  const queryClient = useQueryClient();

  const cartIdQuery = useQuery({
    queryKey: ['cartId', slug],
    queryFn: async () => {
      if (!slug) return null;
      const stored = await AsyncStorage.getItem(`${CART_ID_KEY}.${slug}`);
      return stored;
    },
    enabled: !!slug,
  });

  const cartQuery = useQuery({
    queryKey: ['cart', slug, cartIdQuery.data],
    queryFn: () => getCart(slug!, cartIdQuery.data!),
    enabled: !!slug && !!cartIdQuery.data,
  });

  const addToCart = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      if (!slug) throw new Error('No tenant');

      let cartId = cartIdQuery.data;
      if (!cartId) {
        const newCart = await createCart(slug);
        cartId = newCart.id;
        if (cartId) {
          await AsyncStorage.setItem(`${CART_ID_KEY}.${slug}`, cartId);
        }
      }

      if (!cartId) throw new Error('Failed to create cart');

      const updatedCart = await addCartLine(slug, cartId, { itemId, quantity });
      return updatedCart;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart', slug] });
      queryClient.invalidateQueries({ queryKey: ['cartId', slug] });
    },
  });

  return {
    cart: cartQuery.data,
    cartId: cartIdQuery.data,
    isLoading: cartQuery.isLoading || cartIdQuery.isLoading,
    addToCart,
  };
}
