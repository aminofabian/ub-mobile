import { useMutation } from '@tanstack/react-query';
import { submitCheckout, type CheckoutRequest, type CheckoutResponse } from '../api/storefront';

export function useCheckout(slug: string | undefined, cartId: string | undefined) {
  return useMutation<CheckoutResponse, Error, CheckoutRequest>({
    mutationFn: (request) => submitCheckout(slug!, cartId!, request),
  });
}
