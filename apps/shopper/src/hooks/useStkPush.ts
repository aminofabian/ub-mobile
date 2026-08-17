import { useMutation } from '@tanstack/react-query';
import { initiateStkPush, type StkPushRequest, type StkPushResponse } from '../api/storefront';

export function useStkPush(slug: string | undefined, orderId: string | undefined) {
  return useMutation<StkPushResponse, Error, StkPushRequest>({
    mutationFn: (request) => initiateStkPush(slug!, orderId!, request),
  });
}
